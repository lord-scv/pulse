import uuid
import re
from io import BytesIO
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from apps.posts.models import Post, Hashtag, PostHashtag, PostMention
from apps.users.models import Follow
from apps.notifications.models import Notification

User = get_user_model()

def generate_photo(name='test.png'):
    file = BytesIO()
    image = Image.new('RGB', size=(200, 200), color=(100, 100, 100))
    image.save(file, 'PNG')
    file.name = name
    file.seek(0)
    return SimpleUploadedFile(file.name, file.read(), content_type='image/png')

class PostTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user_author = User.objects.create_user(username='author', email='author@example.com', password='password123', is_verified_email=True)
        self.user_follower = User.objects.create_user(username='follower', email='follower@example.com', password='password123', is_verified_email=True)
        self.user_other = User.objects.create_user(username='other', email='other@example.com', password='password123', is_verified_email=True)
        self.private_author = User.objects.create_user(username='privateauth', email='privateauth@example.com', password='password123', is_private=True, is_verified_email=True)
        
        # Follow relations
        Follow.objects.create(follower=self.user_follower, following=self.user_author, status='ACTIVE')
        
        self.create_url = reverse('api_v1:post-create')
        self.feed_url = reverse('api_v1:feed')
        self.explore_url = reverse('api_v1:explore')

    def test_create_post_success_and_webp_compression(self):
        self.client.force_authenticate(user=self.user_author)
        photo = generate_photo('original.png')
        data = {
            'image': photo,
            'caption': 'Check out this awesome photo! #sunny #day @follower'
        }
        
        # Call create API
        response = self.client.post(self.create_url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Retrieve post and verify it was compressed to WebP
        post_id = response.data['id']
        post = Post.objects.get(id=post_id)
        self.assertTrue(post.image.name.endswith('.webp'))
        
        # Verify hashtags and mentions are parsed
        self.assertTrue(Hashtag.objects.filter(tag='sunny').exists())
        self.assertTrue(Hashtag.objects.filter(tag='day').exists())
        self.assertTrue(PostMention.objects.filter(post=post, mentioned_user=self.user_follower).exists())
        
        # Verify notifications are created
        self.assertTrue(Notification.objects.filter(recipient=self.user_follower, actor=self.user_author, type='MENTION_POST').exists())

    def test_get_feed(self):
        # Create a post for author
        self.client.force_authenticate(user=self.user_author)
        photo = generate_photo()
        self.client.post(self.create_url, {'image': photo, 'caption': 'Author post'}, format='multipart')
        
        # Create a post for other user (not followed)
        self.client.force_authenticate(user=self.user_other)
        photo2 = generate_photo()
        self.client.post(self.create_url, {'image': photo2, 'caption': 'Other post'}, format='multipart')
        
        # Check feed for follower (should see author's post, not other's)
        self.client.force_authenticate(user=self.user_follower)
        response = self.client.get(self.feed_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        captions = [p['caption'] for p in response.data['results']]
        self.assertIn('Author post', captions)
        self.assertNotIn('Other post', captions)

    def test_explore_feed_and_ranking(self):
        # Create two posts
        post1 = Post.objects.create(author=self.user_author, image=generate_photo(), caption='Standard Post')
        post2 = Post.objects.create(author=self.user_other, image=generate_photo(), caption='Highly Engaged Post')
        
        # Add engagement to post2
        Post.objects.filter(id=post2.id).update(like_count=10, comment_count=5)
        
        response = self.client.get(self.explore_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Highly engaged post should be first
        results = response.data['results']
        self.assertEqual(results[0]['id'], str(post2.id))
        self.assertEqual(results[1]['id'], str(post1.id))

    def test_private_profile_post_visibility(self):
        # Create a post for private author
        post = Post.objects.create(author=self.private_author, image=generate_photo(), caption='Private Post')
        
        # Unfollowed user tries to view posts
        self.client.force_authenticate(user=self.user_other)
        url = reverse('api_v1:user-posts', kwargs={'username': 'privateauth'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Follower (ACTIVE) tries to view posts
        Follow.objects.create(follower=self.user_other, following=self.private_author, status='ACTIVE')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_like_unlike_post(self):
        post = Post.objects.create(author=self.user_author, image=generate_photo(), caption='Like me!')
        url = reverse('api_v1:post-like-toggle', kwargs={'pk': post.id})
        
        self.client.force_authenticate(user=self.user_other)
        
        # Like
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        post.refresh_from_db()
        self.assertEqual(post.like_count, 1)
        self.assertTrue(Notification.objects.filter(recipient=self.user_author, actor=self.user_other, type='LIKE_POST', post=post).exists())
        
        # Unlike
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertEqual(post.like_count, 0)
