import uuid
from datetime import timedelta
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.signing import TimestampSigner
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from apps.users.models import Follow, FollowRequest
from apps.notifications.models import Notification

User = get_user_model()
signer = TimestampSigner()

class UserAuthTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.register_url = reverse('api_v1:register')
        self.login_url = reverse('api_v1:login')
        self.logout_url = reverse('api_v1:logout')
        self.check_username_url = reverse('api_v1:check-username')

    def test_registration_success(self):
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'password123',
            'confirm_password': 'password123'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['username'], 'newuser')
        self.assertEqual(response.data['display_name'], 'newuser')
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_registration_password_mismatch(self):
        data = {
            'username': 'mismatch',
            'email': 'mismatch@example.com',
            'password': 'password123',
            'confirm_password': 'differentpassword'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', response.data)

    def test_registration_invalid_username(self):
        data = {
            'username': 'no!special@chars',
            'email': 'invaliduser@example.com',
            'password': 'password123',
            'confirm_password': 'password123'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success_username(self):
        user = User.objects.create_user(username='testuser', email='test@example.com', password='password123')
        data = {'username': 'testuser', 'password': 'password123'}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(user.id))

    def test_login_success_email(self):
        user = User.objects.create_user(username='testuser', email='test@example.com', password='password123')
        data = {'email': 'test@example.com', 'password': 'password123'}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(user.id))

    def test_login_failure_rate_limit(self):
        user = User.objects.create_user(username='testuser', email='test@example.com', password='password123')
        data = {'username': 'testuser', 'password': 'wrongpassword'}
        
        # 4 failed attempts
        for _ in range(4):
            response = self.client.post(self.login_url, data)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(response.data['error']['code'], 'invalid_credentials')

        # 5th attempt locks the account
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)
        self.assertEqual(response.data['error']['code'], 'account_locked')

        # Subsequent attempts are locked immediately
        response = self.client.post(self.login_url, {'username': 'testuser', 'password': 'password123'})
        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)

    def test_email_verification(self):
        user = User.objects.create_user(username='unverified', email='unverified@example.com', password='password123')
        self.assertFalse(user.is_verified_email)
        
        token = signer.sign(str(user.id))
        verify_url = reverse('api_v1:verify-email', kwargs={'token': token})
        
        response = self.client.get(verify_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_verified_email)

    def test_check_username_availability(self):
        User.objects.create_user(username='taken', email='taken@example.com', password='password123')
        
        # Check taken username
        response = self.client.get(f"{self.check_username_url}?username=taken")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['available'])

        # Check available username
        response = self.client.get(f"{self.check_username_url}?username=available")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['available'])

        # Check username with space (invalid)
        response = self.client.get(f"{self.check_username_url}?username=sai chaitanya")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['available'])
        self.assertIn('message', response.data)

        # Check username with special char (invalid)
        response = self.client.get(f"{self.check_username_url}?username=hello!world")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['available'])
        self.assertIn('message', response.data)


class UserProfileAndFollowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user1 = User.objects.create_user(username='userone', email='userone@example.com', password='password123', is_verified_email=True)
        self.user2 = User.objects.create_user(username='usertwo', email='usertwo@example.com', password='password123', is_verified_email=True)
        self.private_user = User.objects.create_user(username='privateuser', email='private@example.com', password='password123', is_private=True, is_verified_email=True)
        
    def test_get_profile(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('api_v1:user-profile', kwargs={'username': 'usertwo'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'usertwo')
        self.assertFalse(response.data['is_following'])

    def test_update_profile(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('api_v1:user-me')
        
        # Test basic profile update
        data = {
            'display_name': 'User One Updated',
            'bio': 'My new bio',
            'website': 'https://example.com'
        }
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user1.refresh_from_db()
        self.assertEqual(self.user1.display_name, 'User One Updated')
        self.assertEqual(self.user1.bio, 'My new bio')

        # Test changing email requires password confirmation
        data = {
            'email': 'newemail@example.com'
        }
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        data = {
            'email': 'newemail@example.com',
            'password': 'password123'
        }
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user1.refresh_from_db()
        self.assertEqual(self.user1.email, 'newemail@example.com')

    def test_delete_profile(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('api_v1:user-me')

        # Invalid delete confirmation
        response = self.client.delete(url, {'username_confirm': 'wrongname'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid delete confirmation
        response = self.client.delete(url, {'username_confirm': 'userone'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.filter(username='userone').exists())

    def test_follow_unfollow_public_user(self):
        self.client.force_authenticate(user=self.user1)
        follow_url = reverse('api_v1:user-follow-toggle', kwargs={'username': 'usertwo'})
        
        # Follow
        response = self.client.post(follow_url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'ACTIVE')
        self.assertTrue(Follow.objects.filter(follower=self.user1, following=self.user2, status='ACTIVE').exists())
        self.assertTrue(Notification.objects.filter(recipient=self.user2, actor=self.user1, type='FOLLOW').exists())
        
        # Unfollow
        response = self.client.delete(follow_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Follow.objects.filter(follower=self.user1, following=self.user2).exists())

    def test_follow_private_user(self):
        self.client.force_authenticate(user=self.user1)
        follow_url = reverse('api_v1:user-follow-toggle', kwargs={'username': 'privateuser'})
        
        # Request follow
        response = self.client.post(follow_url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'PENDING')
        self.assertTrue(Follow.objects.filter(follower=self.user1, following=self.private_user, status='PENDING').exists())
        self.assertTrue(FollowRequest.objects.filter(requester=self.user1, target=self.private_user, status='PENDING').exists())
        self.assertTrue(Notification.objects.filter(recipient=self.private_user, actor=self.user1, type='FOLLOW_REQUEST').exists())

        # Accept follow request
        follow_request = FollowRequest.objects.get(requester=self.user1, target=self.private_user)
        action_url = reverse('api_v1:follow-request-action', kwargs={'pk': follow_request.id})
        
        self.client.force_authenticate(user=self.private_user)
        response = self.client.post(action_url, {'action': 'accept'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.assertTrue(Follow.objects.filter(follower=self.user1, following=self.private_user, status='ACTIVE').exists())
        self.assertTrue(Notification.objects.filter(recipient=self.user1, actor=self.private_user, type='FOLLOW_ACCEPT').exists())

    def test_suggested_users_algorithm(self):
        self.user3 = User.objects.create_user(username='userthree', email='userthree@example.com', password='password123')
        self.user4 = User.objects.create_user(username='userfour', email='userfour@example.com', password='password123')
        
        Follow.objects.create(follower=self.user1, following=self.user2, status='ACTIVE')
        Follow.objects.create(follower=self.user2, following=self.user3, status='ACTIVE')
        Follow.objects.create(follower=self.user2, following=self.user4, status='ACTIVE')
        
        self.client.force_authenticate(user=self.user1)
        suggested_url = reverse('api_v1:user-suggested')
        response = self.client.get(suggested_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        suggested_usernames = [u['username'] for u in response.data]
        self.assertIn('userthree', suggested_usernames)
        self.assertIn('userfour', suggested_usernames)
