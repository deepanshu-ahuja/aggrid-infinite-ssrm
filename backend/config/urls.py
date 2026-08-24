from pathlib import Path

from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.urls import include, path, re_path


def health_check(_request):
    return JsonResponse({"status": "ok"})


def spa_index(_request):
    index_path = Path(settings.FRONTEND_DIST) / "index.html"
    if not index_path.exists():
        return JsonResponse(
            {
                "detail": (
                    "Frontend build not found. Run the Vite development server locally "
                    "or run npm run build before starting the production server."
                )
            },
            status=503,
        )

    return FileResponse(index_path.open("rb"), content_type="text/html")


urlpatterns = [
    path("api/health/", health_check, name="health"),
    path("api/transactions/", include("apps.transactions.api.urls")),
    # Client-side routes must return index.html after the API routes have had a chance to match.
    re_path(r"^(?!api/).*$", spa_index, name="spa-index"),
]
