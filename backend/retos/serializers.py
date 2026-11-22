from django.utils import timezone
from django.db import transaction
from rest_framework import serializers

from .models import AccionRecuperacion, Avance, PlanRecuperacion, Reto, TareaSemanal


class AvanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Avance
        fields = ['id', 'reto', 'fecha', 'descripcion', 'porcentaje', 'creado']
        read_only_fields = ['creado']


class RetoSerializer(serializers.ModelSerializer):
    total_avances = serializers.IntegerField(source='avances.count', read_only=True)

    class Meta:
        model = Reto
        fields = [
            'id', 'titulo', 'descripcion', 'fecha_inicio', 'fecha_fin',
            'estado', 'total_avances', 'creado', 'actualizado',
        ]
        read_only_fields = ['creado', 'actualizado']

    def validate(self, datos):
        inicio = datos.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        fin = datos.get('fecha_fin', getattr(self.instance, 'fecha_fin', None))
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError(
                {'fecha_fin': 'La fecha de fin no puede ser anterior a la fecha de inicio.'}
            )
        return datos


class TareaSemanalSerializer(serializers.ModelSerializer):
    reto_titulo = serializers.CharField(source='reto.titulo', read_only=True)
    recuperacion_id = serializers.IntegerField(
        source='recuperacion.id', read_only=True, default=None
    )

    class Meta:
        model = TareaSemanal
        fields = [
            'id', 'reto', 'reto_titulo', 'semana', 'fecha_inicio', 'fecha_fin',
            'descripcion', 'porcentaje', 'actualizado', 'recuperacion_id',
        ]
        read_only_fields = ['reto', 'semana', 'fecha_inicio', 'fecha_fin', 'actualizado']

    def validate(self, datos):
        tarea = self.instance
        hoy = timezone.localdate()
        if tarea is not None:
            if hoy > tarea.fecha_fin:
                raise serializers.ValidationError(
                    f'La semana {tarea.semana} ya está cerrada; no se puede modificar.'
                )
            if hoy < tarea.fecha_inicio:
                raise serializers.ValidationError(
                    f'La semana {tarea.semana} todavía no ha comenzado.'
                )
        return datos


class AccionRecuperacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccionRecuperacion
        fields = ['id', 'descripcion', 'orden', 'completada', 'completada_en']
        read_only_fields = ['id', 'orden', 'completada', 'completada_en']


class PlanRecuperacionSerializer(serializers.ModelSerializer):
    reto = serializers.IntegerField(source='tarea.reto_id', read_only=True)
    reto_titulo = serializers.CharField(source='tarea.reto.titulo', read_only=True)
    semana = serializers.IntegerField(source='tarea.semana', read_only=True)
    porcentaje_original = serializers.IntegerField(source='tarea.porcentaje', read_only=True)
    fecha_cierre = serializers.DateField(source='tarea.fecha_fin', read_only=True)
    acciones = AccionRecuperacionSerializer(many=True, min_length=1, max_length=12)
    estado = serializers.SerializerMethodField()
    progreso = serializers.SerializerMethodField()
    total_acciones = serializers.SerializerMethodField()
    acciones_completadas = serializers.SerializerMethodField()

    class Meta:
        model = PlanRecuperacion
        fields = [
            'id', 'tarea', 'reto', 'reto_titulo', 'semana', 'porcentaje_original',
            'fecha_cierre', 'objetivo', 'fecha_limite', 'acciones', 'estado',
            'progreso', 'total_acciones', 'acciones_completadas', 'creado',
        ]
        read_only_fields = ['creado']

    def get_estado(self, plan) -> str:
        return plan.resumen()['estado']

    def get_progreso(self, plan) -> int:
        return plan.resumen()['progreso']

    def get_total_acciones(self, plan) -> int:
        return plan.resumen()['total_acciones']

    def get_acciones_completadas(self, plan) -> int:
        return plan.resumen()['acciones_completadas']

    def validate_tarea(self, tarea):
        if timezone.localdate() <= tarea.fecha_fin or tarea.porcentaje >= 10:
            raise serializers.ValidationError(
                'El plan solo puede crearse para una semana cerrada en rojo (menos de 10 %).'
            )
        return tarea

    def validate_fecha_limite(self, fecha):
        if fecha < timezone.localdate():
            raise serializers.ValidationError('La fecha límite no puede ser anterior a hoy.')
        return fecha

    def validate_acciones(self, acciones):
        nombres = [accion['descripcion'].casefold() for accion in acciones]
        if len(nombres) != len(set(nombres)):
            raise serializers.ValidationError('Las acciones no deben repetirse.')
        return acciones

    @transaction.atomic
    def create(self, datos):
        acciones = datos.pop('acciones')
        tarea = TareaSemanal.objects.select_for_update().get(pk=datos['tarea'].pk)
        self.validate_tarea(tarea)
        if PlanRecuperacion.objects.filter(tarea=tarea).exists():
            raise serializers.ValidationError({'tarea': 'Esta semana ya tiene un plan de recuperación.'})
        datos['tarea'] = tarea
        plan = PlanRecuperacion.objects.create(**datos)
        AccionRecuperacion.objects.bulk_create([
            AccionRecuperacion(plan=plan, descripcion=accion['descripcion'], orden=orden)
            for orden, accion in enumerate(acciones, start=1)
        ])
        return plan


class AccionEstadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccionRecuperacion
        fields = ['completada']

    def validate(self, datos):
        if 'completada' not in datos:
            raise serializers.ValidationError('Indica si la acción está completada.')
        return datos

    def update(self, accion, datos):
        completada = datos['completada']
        if completada != accion.completada:
            accion.completada = completada
            accion.completada_en = timezone.now() if completada else None
            accion.save(update_fields=['completada', 'completada_en'])
        return accion
