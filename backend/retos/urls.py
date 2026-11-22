from rest_framework.routers import DefaultRouter

from .views import AvanceViewSet, PlanRecuperacionViewSet, RetoViewSet, TareaSemanalViewSet

router = DefaultRouter()
router.register('retos', RetoViewSet)
router.register('avances', AvanceViewSet)
router.register('tareas', TareaSemanalViewSet)
router.register('recuperaciones', PlanRecuperacionViewSet)

urlpatterns = router.urls
