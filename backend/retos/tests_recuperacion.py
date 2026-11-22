from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import AccionRecuperacion, PlanRecuperacion, Reto, TareaSemanal


class RecuperacionApiTests(APITestCase):
    def setUp(self):
        self.hoy = timezone.localdate()
        self.reto = Reto.objects.create(titulo='Lectura de prueba', fecha_inicio=self.hoy)
        self.tarea = TareaSemanal.objects.create(
            reto=self.reto, semana=7, porcentaje=5,
            fecha_inicio=self.hoy - timedelta(days=7),
            fecha_fin=self.hoy - timedelta(days=1),
        )
        self.url = reverse('planrecuperacion-list')

    def datos(self, **cambios):
        datos = {
            'tarea': self.tarea.pk, 'objetivo': 'Recuperar la lectura pendiente',
            'fecha_limite': str(self.hoy + timedelta(days=7)),
            'acciones': [{'descripcion': nombre} for nombre in [
                'Leer 20 páginas', 'Terminar el capítulo', 'Escribir un resumen',
            ]],
        }
        return datos | cambios

    def crear(self):
        respuesta = self.client.post(self.url, self.datos(), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data

    def accion(self, plan, indice=0, completada=True):
        url = reverse('planrecuperacion-cambiar-accion', args=[plan['id'], plan['acciones'][indice]['id']])
        return self.client.patch(url, {'completada': completada}, format='json')

    def test_crea_plan_y_consulta_por_reto_y_tarea(self):
        plan = self.crear()
        self.assertEqual(plan['estado'], 'PENDIENTE')
        self.assertEqual(plan['progreso'], 0)
        self.assertEqual([a['orden'] for a in plan['acciones']], [1, 2, 3])
        for filtro in [{'reto': self.reto.pk}, {'tarea': self.tarea.pk}]:
            respuesta = self.client.get(self.url, filtro)
            self.assertEqual(respuesta.status_code, 200)
            self.assertEqual([p['id'] for p in respuesta.data], [plan['id']])
        tarea = self.client.get(reverse('tareasemanal-detail', args=[self.tarea.pk]))
        self.assertEqual(tarea.data['recuperacion_id'], plan['id'])

    def test_solo_admite_semanas_cerradas_en_rojo(self):
        for fin, porcentaje in [(self.hoy, 0), (self.hoy + timedelta(days=7), 0),
                                (self.hoy - timedelta(days=1), 10),
                                (self.hoy - timedelta(days=1), 100)]:
            with self.subTest(fin=fin, porcentaje=porcentaje):
                self.tarea.fecha_fin, self.tarea.porcentaje = fin, porcentaje
                self.tarea.save()
                respuesta = self.client.post(self.url, self.datos(), format='json')
                self.assertEqual(respuesta.status_code, 400)
        self.assertFalse(PlanRecuperacion.objects.exists())

    def test_rechaza_fecha_pasada_y_acciones_invalidas_sin_crear_datos(self):
        casos = [
            {'fecha_limite': str(self.hoy - timedelta(days=1))},
            {'objetivo': ' '}, {'acciones': []},
            {'acciones': [{'descripcion': '   '}]},
            {'acciones': [{'descripcion': 'Leer'}, {'descripcion': ' leer '}]},
            {'acciones': [{'descripcion': f'Acción {i}'} for i in range(13)]},
        ]
        for cambios in casos:
            with self.subTest(cambios=cambios):
                respuesta = self.client.post(self.url, self.datos(**cambios), format='json')
                self.assertEqual(respuesta.status_code, 400, respuesta.data)
        self.assertEqual(PlanRecuperacion.objects.count(), 0)
        self.assertEqual(AccionRecuperacion.objects.count(), 0)

    def test_impide_dos_planes_para_la_misma_semana(self):
        self.crear()
        respuesta = self.client.post(self.url, self.datos(), format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(PlanRecuperacion.objects.count(), 1)
        self.assertEqual(AccionRecuperacion.objects.count(), 3)

    def test_progreso_persistente_no_cambia_ni_desbloquea_la_semana_original(self):
        plan = self.crear()
        for indice, progreso in enumerate([33, 67, 100]):
            respuesta = self.accion(plan, indice)
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
            self.assertEqual(respuesta.data['progreso'], progreso)
            self.assertEqual(respuesta.data['acciones_completadas'], indice + 1)
            self.assertIsNotNone(respuesta.data['acciones'][indice]['completada_en'])
        consulta = self.client.get(reverse('planrecuperacion-detail', args=[plan['id']]))
        self.assertEqual(consulta.data['estado'], 'COMPLETADO')
        self.assertEqual(consulta.data['progreso'], 100)
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.porcentaje, 5)
        self.assertEqual(self.tarea.fecha_fin, self.hoy - timedelta(days=1))
        bloqueo = self.client.patch(reverse('tareasemanal-detail', args=[self.tarea.pk]),
                                   {'porcentaje': 100}, format='json')
        self.assertEqual(bloqueo.status_code, 400)

    def test_marcar_dos_veces_conserva_la_fecha_y_desmarcar_recalcula(self):
        plan = self.crear()
        primera = self.accion(plan)
        segunda = self.accion(plan)
        self.assertEqual(primera.data['acciones'][0]['completada_en'],
                         segunda.data['acciones'][0]['completada_en'])
        desmarcada = self.accion(plan, completada=False)
        self.assertEqual(desmarcada.data['progreso'], 0)
        self.assertEqual(desmarcada.data['estado'], 'PENDIENTE')
        self.assertIsNone(desmarcada.data['acciones'][0]['completada_en'])

    def test_vencimiento_se_calcula_en_el_servidor_y_permite_recuperar_tarde(self):
        plan = self.crear()
        futuro = self.hoy + timedelta(days=8)
        with patch('retos.models.timezone.localdate', return_value=futuro):
            vencido = self.client.get(reverse('planrecuperacion-detail', args=[plan['id']]))
            self.assertEqual(vencido.data['estado'], 'VENCIDO')
            for indice in range(3):
                respuesta = self.accion(plan, indice)
            self.assertEqual(respuesta.data['estado'], 'COMPLETADO')

    def test_no_permite_modificar_acciones_de_otro_plan(self):
        primero = self.crear()
        otra = TareaSemanal.objects.create(
            reto=self.reto, semana=8, porcentaje=0,
            fecha_inicio=self.hoy - timedelta(days=7), fecha_fin=self.hoy - timedelta(days=1),
        )
        segundo = self.client.post(self.url, self.datos(tarea=otra.pk), format='json').data
        url = reverse('planrecuperacion-cambiar-accion', args=[primero['id'], segundo['acciones'][0]['id']])
        respuesta = self.client.patch(url, {'completada': True}, format='json')
        self.assertEqual(respuesta.status_code, 404)
        self.assertFalse(AccionRecuperacion.objects.get(pk=segundo['acciones'][0]['id']).completada)

    def test_el_cliente_no_puede_falsificar_progreso_ni_finalizacion(self):
        datos = self.datos(progreso=100, estado='COMPLETADO')
        datos['acciones'][0]['completada'] = True
        respuesta = self.client.post(self.url, datos, format='json')
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['progreso'], 0)
        self.assertFalse(respuesta.data['acciones'][0]['completada'])
        plan = respuesta.data
        url = reverse('planrecuperacion-cambiar-accion', args=[plan['id'], plan['acciones'][0]['id']])
        self.assertEqual(self.client.patch(url, {}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'completada': 'talvez'}, format='json').status_code, 400)
