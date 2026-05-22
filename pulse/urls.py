from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api.v1.urls', namespace='api_v1')),
]

# Serve media and static files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# SPA fallback router: catch-all path that serves the frontend SPA shell
urlpatterns += [
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html'), name='spa'),
]
