import django_filters

from .models import PlanRecuperacion, Reto


class PlanRecuperacionFiltro(django_filters.FilterSet):
    reto = django_filters.ModelChoiceFilter(
        field_name='tarea__reto', queryset=Reto.objects.all()
    )

    class Meta:
        model = PlanRecuperacion
        fields = ['reto', 'tarea']
