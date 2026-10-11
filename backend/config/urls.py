from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [path("api/", include("rehearsals.urls"))]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
