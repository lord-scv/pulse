import os
import re
import urllib.request
from io import BytesIO
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction, models
from django.utils import timezone

from apps.users.models import Follow
from apps.posts.models import Post, Hashtag, PostHashtag, PostMention
from apps.comments.models import Comment
from apps.likes.models import PostLike, CommentLike
from apps.notifications.models import Notification
from pulse.utils import compress_to_webp

User = get_user_model()

USERS_DATA = [
    {
        "username": "sarah_design",
        "email": "sarah@example.com",
        "display_name": "Sarah Jenkins",
        "bio": "UI/UX Designer | Passionate about clean interfaces, dark modes, and micro-interactions. Let's create beautiful things! ✨",
        "website": "https://sarahjenkins.design",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80"
    },
    {
        "username": "alex_travels",
        "email": "alex@example.com",
        "display_name": "Alex Mercer",
        "bio": "Travel & Landscape Photographer. Capturing moments around the globe. Currently exploring the Swiss Alps. 🏔️✈️",
        "website": "https://alexmercer.photography",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=250&auto=format&fit=crop&q=80"
    },
    {
        "username": "elena_codes",
        "email": "elena@example.com",
        "display_name": "Elena Rostova",
        "bio": "Software Engineer | Open Source Enthusiast. I turn coffee into clean code. Let's build the future! 💻☕",
        "website": "https://elenacodes.dev",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=250&auto=format&fit=crop&q=80"
    },
    {
        "username": "marcus_fit",
        "email": "marcus@example.com",
        "display_name": "Marcus Chen",
        "bio": "Strength & Conditioning Coach. Helping you build a resilient mind and body. No excuses, only progress. 💪🔥",
        "website": "https://marcuschenfit.com",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=250&auto=format&fit=crop&q=80"
    },
    {
        "username": "chef_lucas",
        "email": "lucas@example.com",
        "display_name": "Chef Lucas",
        "bio": "Culinary Artist. Making food that looks like art and tastes like heaven. Private dining and recipe developer. 🍳🍷",
        "website": "https://cheflucas.com",
        "avatar_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=250&auto=format&fit=crop&q=80"
    },
    {
        "username": "maya_nature",
        "email": "maya@example.com",
        "display_name": "Maya Lin",
        "bio": "Environmentalist & Nature Enthusiast. Planting trees, protecting oceans, and documenting the beauty of our planet. 🌿🌊",
        "website": "https://mayalin.earth",
        "avatar_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=250&auto=format&fit=crop&q=80"
    }
]

POSTS_DATA = [
    {
        "username": "alex_travels",
        "image_url": "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&auto=format&fit=crop&q=80",
        "caption": "Woke up at 5 AM to catch this breathtaking sunrise over the mountains. Absolutely worth the freeze! 🏔️🌅 #travel #wanderlust #landscape #adventure",
    },
    {
        "username": "sarah_design",
        "image_url": "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
        "caption": "Behind the scenes of my new dark-mode design system. Loving how the indigo accent glows on deep backgrounds. Thoughts? 🎨⚡ #uidesign #ux #webdesign #darkmode",
    },
    {
        "username": "elena_codes",
        "image_url": "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=800&auto=format&fit=crop&q=80",
        "caption": "Re-architecting our backend notifications service today. Keeping database queries optimized to avoid N+1 issues. Code is clean and fast! 🚀🐍 #backend #django #python #programming @sarah_design",
    },
    {
        "username": "chef_lucas",
        "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
        "caption": "Pan-seared duck breast with a raspberry reduction, toasted hazelnuts, and fresh micro-greens. Dinner is served. 🦆🍇🍽️ #gourmet #chefmode #culinary #foodporn",
    },
    {
        "username": "marcus_fit",
        "image_url": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
        "caption": "Consistency beats talent every single day. Keep showing up, keep putting in the work. 💥👟 #fitnessmotivation #workout #discipline #noexcuses",
    },
    {
        "username": "maya_nature",
        "image_url": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&auto=format&fit=crop&q=80",
        "caption": "A peaceful walk through the forest is the best remedy for a busy mind. Let's protect these sacred green spaces. 🌲☀️🍃 #naturelovers #conservation #forest #mindfulness",
    },
    {
        "username": "alex_travels",
        "image_url": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80",
        "caption": "Lost in the mist. There's something magical about quiet, foggy mornings in the Pacific Northwest. 🌲🌫️ #pnw #adventure #wilderness @maya_nature",
    },
    {
        "username": "sarah_design",
        "image_url": "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=800&auto=format&fit=crop&q=80",
        "caption": "Decluttered workspace = decluttered mind. Ready for a heavy coding week! Designing some new onboarding screen flows today. 🖥️✨ #minimalist #desksetup #workspace @elena_codes",
    },
    {
        "username": "chef_lucas",
        "image_url": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80",
        "caption": "Made some classic Neapolitan sourdough pizza tonight. San Marzano tomatoes, fresh buffalo mozzarella, and fresh basil. Simple is best! 🍕🇮🇹 #pizza #sourdough #italianfood",
    }
]

COMMENTS_DATA = [
    {
        "post_index": 0,
        "comments": [
            ("sarah_design", "Wow, the colors in this are absolutely insane, Alex! What lens did you use?"),
            ("alex_travels", "@sarah_design Thanks Sarah! Used a 24-70mm f/2.8 lens at 24mm. Exposure was around 1.3s."),
            ("maya_nature", "This is pure magic. Nature never ceases to amaze me. 💚"),
            ("chef_lucas", "Beautiful shot! Makes me want to go hiking... almost. 😂")
        ]
    },
    {
        "post_index": 1,
        "comments": [
            ("elena_codes", "This look is incredibly sleek! Can't wait to code the implementation for this component. 💻🔥"),
            ("sarah_design", "@elena_codes representation of Figma tokens is ready! Let's pair on it."),
            ("marcus_fit", "Clean and premium! Reminds me of high-tech gear.")
        ]
    },
    {
        "post_index": 2,
        "comments": [
            ("sarah_design", "Yes! Optimized APIs are the best. The transitions on the frontend feel so much smoother now!"),
            ("elena_codes", "@sarah_design Absolutely, keeping it fast is top priority! 🚀"),
            ("alex_travels", "Love seeing the engineering side of things. Keep up the awesome work Elena!")
        ]
    },
    {
        "post_index": 3,
        "comments": [
            ("marcus_fit", "Now that is a high-quality protein source! Looks delicious Chef! 💪"),
            ("chef_lucas", "@marcus_fit Haha, thanks Marcus! Great macros too!"),
            ("sarah_design", "The plating composition is a work of art. 🤩")
        ]
    }
]

def download_image(url):
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read()
    except Exception as e:
        print(f"Failed to download image from {url}: {e}")
        return None

class Command(BaseCommand):
    help = "Seeds the database with rich mock data for active users, follows, posts, comments, and likes."

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Wiping existing non-superuser data..."))
        
        # Clear existing models (excluding superusers)
        superusers = list(User.objects.filter(is_superuser=True))
        superuser_ids = [u.id for u in superusers]
        
        # Wipe other items
        Notification.objects.all().delete()
        CommentLike.objects.all().delete()
        PostLike.objects.all().delete()
        Comment.objects.all().delete()
        PostMention.objects.all().delete()
        PostHashtag.objects.all().delete()
        Hashtag.objects.all().delete()
        Post.objects.all().delete()
        Follow.objects.all().delete()
        User.objects.exclude(id__in=superuser_ids).delete()
        
        self.stdout.write(self.style.SUCCESS("Wipe complete. Starting seeding process..."))

        # Create mock users
        created_users = {}
        for udata in USERS_DATA:
            username = udata["username"]
            self.stdout.write(f"Creating user: @{username}")
            
            user = User.objects.create(
                username=username,
                email=udata["email"],
                display_name=udata["display_name"],
                bio=udata["bio"],
                website=udata["website"],
                is_verified_email=True
            )
            user.set_password("password123")
            
            # Seed profile picture
            img_bytes = download_image(udata["avatar_url"])
            if img_bytes:
                content_file = ContentFile(img_bytes, name=f"{username}_avatar.jpg")
                compressed = compress_to_webp(content_file)
                if compressed:
                    user.profile_photo.save(f"{username}_avatar.webp", compressed, save=False)
            
            user.save()
            created_users[username] = user

        # Set up Follows
        self.stdout.write("Establishing follower/following relationships...")
        usernames = list(created_users.keys())
        for i, username in enumerate(usernames):
            user = created_users[username]
            # Follow the next 3 users in the list circularly
            for j in range(1, 4):
                target_username = usernames[(i + j) % len(usernames)]
                target_user = created_users[target_username]
                Follow.objects.create(follower=user, following=target_user, status="ACTIVE")

        # Create Posts
        self.stdout.write("Creating mock posts and parsing hashtags/mentions...")
        created_posts = []
        for index, pdata in enumerate(POSTS_DATA):
            username = pdata["username"]
            author = created_users[username]
            self.stdout.write(f"Post {index + 1} by @{username}")

            post = Post.objects.create(
                author=author,
                caption=pdata["caption"]
            )

            # Seed post image
            img_bytes = download_image(pdata["image_url"])
            if img_bytes:
                content_file = ContentFile(img_bytes, name=f"post_{index}.jpg")
                compressed = compress_to_webp(content_file)
                if compressed:
                    post.image.save(f"post_{index}.webp", compressed, save=False)
            
            post.save()
            created_posts.append(post)

            # Parse hashtags and mentions (replicating serializer logic)
            self._parse_hashtags_and_mentions(post, pdata["caption"])

        # Create Comments
        self.stdout.write("Seeding comments and notifications...")
        for cdata in COMMENTS_DATA:
            post = created_posts[cdata["post_index"]]
            for comment_username, body in cdata["comments"]:
                comment_author = created_users[comment_username]
                
                comment = Comment.objects.create(
                    post=post,
                    author=comment_author,
                    body=body
                )
                
                # Increment post comment count
                Post.objects.filter(id=post.id).update(comment_count=models.F('comment_count') + 1)
                
                # Create notification if comment is by another user
                if comment_author != post.author:
                    Notification.objects.create(
                        recipient=post.author,
                        actor=comment_author,
                        type="COMMENT",
                        post=post,
                        comment=comment
                    )

        # Create Likes
        self.stdout.write("Seeding likes and liking notifications...")
        for i, post in enumerate(created_posts):
            # Liking by other users (circularly select 2-3 users to like)
            author_username = post.author.username
            all_other_usernames = [u for u in usernames if u != author_username]
            
            # Give 2 likes to each post
            liker_usernames = all_other_usernames[:3]
            for liker_username in liker_usernames:
                liker = created_users[liker_username]
                PostLike.objects.create(user=liker, post=post)
                Post.objects.filter(id=post.id).update(like_count=models.F('like_count') + 1)
                
                # Notify post owner
                Notification.objects.create(
                    recipient=post.author,
                    actor=liker,
                    type="LIKE_POST",
                    post=post
                )

        self.stdout.write(self.style.SUCCESS("Database seeded successfully with active mock data!"))

    def _parse_hashtags_and_mentions(self, post, caption):
        if not caption:
            return
            
        # Extract hashtags
        hashtags = set(re.findall(r'#(\w+)', caption))
        for tag in hashtags:
            tag_lower = tag.lower()
            hashtag, created = Hashtag.objects.get_or_create(tag=tag_lower)
            PostHashtag.objects.get_or_create(post=post, hashtag=hashtag)
            # Increment tag counter
            Hashtag.objects.filter(id=hashtag.id).update(post_count=models.F('post_count') + 1)
            
        # Extract mentions
        mentions = set(re.findall(r'@(\w+)', caption))
        for m in mentions:
            try:
                mentioned_user = User.objects.get(username__iexact=m)
                PostMention.objects.get_or_create(post=post, mentioned_user=mentioned_user)
                if mentioned_user != post.author:
                    Notification.objects.create(
                        recipient=mentioned_user,
                        actor=post.author,
                        type='MENTION_POST',
                        post=post
                    )
            except User.DoesNotExist:
                pass
