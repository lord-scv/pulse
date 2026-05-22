import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator, MinLengthValidator
from django.conf import settings

class User(AbstractUser):
    # Custom UUID Primary Key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Custom username rules (3-20 chars, alphanumeric + underscores only)
    username = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        validators=[
            RegexValidator(
                regex=r'^\w+$',
                message='Username can only contain letters, numbers, and underscores.',
                code='invalid_username'
            ),
            MinLengthValidator(3, message='Username must be at least 3 characters long.')
        ]
    )
    
    # Email is unique and indexed
    email = models.EmailField(unique=True, db_index=True)
    
    display_name = models.CharField(max_length=60, blank=True, null=True)
    bio = models.CharField(max_length=160, blank=True, null=True)
    website = models.URLField(max_length=200, blank=True, null=True)
    profile_photo = models.ImageField(upload_to='profile_photos/', blank=True, null=True)
    
    is_private = models.BooleanField(default=False)
    is_verified_email = models.BooleanField(default=False)
    last_active = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return self.username


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='following_relations'
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='follower_relations'
    )
    status = models.CharField(
        max_length=10,
        choices=[('ACTIVE', 'Active'), ('PENDING', 'Pending')],
        default='ACTIVE'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')
        indexes = [
            models.Index(fields=['follower', 'following']),
        ]

    def __str__(self):
        return f"{self.follower.username} follows {self.following.username} ({self.status})"


class FollowRequest(models.Model):
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_follow_requests'
    )
    target = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_follow_requests'
    )
    status = models.CharField(
        max_length=10,
        choices=[
            ('PENDING', 'Pending'),
            ('ACCEPTED', 'Accepted'),
            ('DECLINED', 'Declined')
        ],
        default='PENDING'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('requester', 'target')

    def __str__(self):
        return f"{self.requester.username} to {self.target.username} ({self.status})"
