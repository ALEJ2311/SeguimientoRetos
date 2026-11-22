from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .filtros import PlanRecuperacionFiltro
from .models import AccionRecuperacion, Avance, PlanRecuperacion, Reto, TareaSemanal
from .semanas import crear_tareas_semanales
from .serializers import (
    AccionEstadoSerializer, AvanceSerializer, PlanRecuperacionSerializer,
    RetoSerializer, TareaSemanalSerializer,
)


class RetoViewSet(viewsets.ModelViewSet):
    """Listar, crear, consultar, modificar y eliminar retos."""

    queryset = Reto.objects.all()
    serializer_class = RetoSerializer
    filterset_fields = ['estado']
    search_fields = ['titulo', 'descripcion']
    ordering_fields = ['fecha_inicio', 'titulo', 'estado']

    def perform_create(self, serializer):
        reto = serializer.save()
        crear_tareas_semanales(reto)

    @action(detail=True, methods=['post'], url_path='generar-semanas')
    def generar_semanas(self, request, pk=None):
        """Crea las semanas que falten (útil para retos creados antes de esta guía)."""
        creadas = crear_tareas_semanales(self.get_object())
        return Response({'creadas': creadas}, status=status.HTTP_200_OK)


class AvanceViewSet(viewsets.ModelViewSet):
    """Listar, crear, consultar, modificar y eliminar avances."""

    queryset = Avance.objects.select_related('reto')
    serializer_class = AvanceSerializer
    filterset_fields = ['reto']
    ordering_fields = ['fecha', 'porcentaje']


class TareaSemanalViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Consultar y actualizar tareas semanales. Se crean solas; no se borran."""

    queryset = TareaSemanal.objects.select_related('reto', 'recuperacion')
    serializer_class = TareaSemanalSerializer
    filterset_fields = ['reto', 'semana']
    ordering_fields = ['semana']
    pagination_class = None


class PlanRecuperacionViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Crear planes para semanas cerradas en rojo y consultar su recuperación."""

    queryset = PlanRecuperacion.objects.select_related('tarea__reto').prefetch_related('acciones')
    serializer_class = PlanRecuperacionSerializer
    filterset_class = PlanRecuperacionFiltro
    pagination_class = None

    @extend_schema(request=AccionEstadoSerializer, responses=PlanRecuperacionSerializer)
    @action(detail=True, methods=['patch'], url_path=r'acciones/(?P<accion_id>\d+)')
    @transaction.atomic
    def cambiar_accion(self, request, pk=None, accion_id=None):
        plan = self.get_object()
        accion = get_object_or_404(
            AccionRecuperacion.objects.select_for_update(), pk=accion_id, plan=plan
        )
        serializer = AccionEstadoSerializer(accion, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        actualizado = self.get_queryset().get(pk=plan.pk)
        return Response(self.get_serializer(actualizado).data)
