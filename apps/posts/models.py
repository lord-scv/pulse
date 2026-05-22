import uuid
import re
from django.db import models
from django.conf import settings

class Hashtag(models.Model):
    tag = models.CharField(max_length=100, unique=True, db_index=True)
    post_count = models.IntegerField(default=0)

    def __str__(self):
        return self.tag


class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts'
    )
    image = models.ImageField(upload_to='posts/')
    caption = models.TextField(max_length=2200, blank=True, null=True)
    comments_disabled = models.BooleanField(default=False)
    
    # Denormalized counters
    like_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    hashtags = models.ManyToManyField(
        Hashtag,
        through='PostHashtag',
        related_name='posts'
    )

    class Meta:
        ordering = ['-created_at']

    def delete(self, *args, **kwargs):
        # Decrement hashtag counters
        for hashtag in self.hashtags.all():
            hashtag.post_count = max(0, hashtag.post_count - 1)
            hashtag.save()
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"Post {self.id} by {self.author.username}"


class PostHashtag(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    hashtag = models.ForeignKey(Hashtag, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('post', 'hashtag')


class PostMention(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='post_mentions'
    )
    mentioned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mentions_received'
    )

    class Meta:
        unique_together = ('post', 'mentioned_user')
