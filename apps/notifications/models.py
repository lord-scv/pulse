import uuid
from django.db import models
from django.conf import settings

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('LIKE_POST', 'Like on Post'),
        ('COMMENT', 'Comment on Post'),
        ('FOLLOW', 'New Follower (Public)'),
        ('FOLLOW_REQUEST', 'Follow Request (Private)'),
        ('FOLLOW_ACCEPT', 'Follow Request Accepted'),
        ('COMMENT_REPLY', 'Reply to Comment'),
        ('COMMENT_LIKE', 'Like on Comment'),
        ('MENTION_POST', 'Mention in Post'),
        ('MENTION_COMMENT', 'Mention in Comment'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications_triggered'
    )
    type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    post = models.ForeignKey(
        'posts.Post',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    comment = models.ForeignKey(
        'comments.Comment',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification {self.id} for {self.recipient.username}: {self.type}"
