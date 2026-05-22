import uuid
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from apps.posts.models import Post
from apps.comments.models import Comment
from apps.notifications.models import Notification
from apps.likes.models import CommentLike

User = get_user_model()

class CommentTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.author = User.objects.create_user(username='author', email='author@example.com', password='password123', is_verified_email=True)
        self.commenter = User.objects.create_user(username='commenter', email='commenter@example.com', password='password123', is_verified_email=True)
        self.user_other = User.objects.create_user(username='other', email='other@example.com', password='password123', is_verified_email=True)
        
        # Create a mock post
        self.post = Post.objects.create(author=self.author, caption='A beautiful day')
        self.comment_list_url = reverse('api_v1:comment-list-create', kwargs={'pk': self.post.id})

    def test_create_comment_success(self):
        self.client.force_authenticate(user=self.commenter)
        
        # Test creating a top-level comment
        response = self.client.post(self.comment_list_url, {'body': 'Great post! @author'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['body'], 'Great post! @author')
        
        comment_id = response.data['id']
        comment = Comment.objects.get(id=comment_id)
        self.assertEqual(comment.post, self.post)
        
        # Verify notification sent to post author
        self.assertTrue(Notification.objects.filter(recipient=self.author, actor=self.commenter, type='COMMENT', post=self.post, comment=comment).exists())
        self.assertTrue(Notification.objects.filter(recipient=self.author, actor=self.commenter).exists())

    def test_create_reply_success(self):
        # Create top-level comment
        parent = Comment.objects.create(post=self.post, author=self.author, body='Original comment')
        
        self.client.force_authenticate(user=self.commenter)
        response = self.client.post(self.comment_list_url, {
            'body': 'Replying to your comment',
            'parent_comment': parent.id
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        reply_id = response.data['id']
        reply = Comment.objects.get(id=reply_id)
        self.assertEqual(reply.parent_comment, parent)
        
        # Verify notification sent to parent comment author
        self.assertTrue(Notification.objects.filter(recipient=self.author, actor=self.commenter, type='COMMENT_REPLY', post=self.post, comment=reply).exists())

    def test_comment_soft_and_hard_delete(self):
        parent = Comment.objects.create(post=self.post, author=self.commenter, body='Parent comment')
        reply = Comment.objects.create(post=self.post, author=self.user_other, parent_comment=parent, body='Reply comment')
        
        delete_parent_url = reverse('api_v1:comment-delete', kwargs={'pk': parent.id})
        delete_reply_url = reverse('api_v1:comment-delete', kwargs={'pk': reply.id})
        
        # Authenticate commenter to delete parent comment
        self.client.force_authenticate(user=self.commenter)
        
        # Deleting parent should soft delete it because it has replies
        response = self.client.delete(delete_parent_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        parent.refresh_from_db()
        self.assertTrue(parent.is_deleted)
        self.assertEqual(parent.body, '[Comment removed]')
        
        # Deleting reply should hard delete it because it has no replies
        self.client.force_authenticate(user=self.user_other)
        response = self.client.delete(delete_reply_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Comment.objects.filter(id=reply.id).exists())
        
        # Now deleting parent comment again since reply is gone (has no replies left)
        self.client.force_authenticate(user=self.commenter)
        response = self.client.delete(delete_parent_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Comment.objects.filter(id=parent.id).exists())

    def test_comment_like_unlike(self):
        comment = Comment.objects.create(post=self.post, author=self.commenter, body='Like this comment')
        url = reverse('api_v1:comment-like-toggle', kwargs={'pk': comment.id})
        
        self.client.force_authenticate(user=self.user_other)
        
        # Like comment
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        comment.refresh_from_db()
        self.assertEqual(comment.like_count, 1)
        self.assertTrue(Notification.objects.filter(recipient=self.commenter, actor=self.user_other, type='COMMENT_LIKE', comment=comment).exists())
        
        # Unlike comment
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        comment.refresh_from_db()
        self.assertEqual(comment.like_count, 0)
