import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanRecuperacion, TareaSemanal } from '../core/modelos';
import { RetosApi } from '../core/retos-api.service';
import { hoyIso } from '../core/semaforo';
import { SeguimientoService } from '../core/seguimiento.service';
import { RecuperacionPage } from './recuperacion.page';

describe('guardado del plan de recuperación', () => {
  afterEach(() => TestBed.resetTestingModule());

  function preparar() {
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const tarea: TareaSemanal = {
      id: 46, reto: 6, reto_titulo: 'Lectura', semana: 7, porcentaje: 5,
      fecha_inicio: '2020-01-01', fecha_fin: hoyIso(ayer), descripcion: '', actualizado: '',
    };
    const plan: PlanRecuperacion = {
      id: 1, tarea: 46, reto: 6, reto_titulo: 'Lectura', semana: 7,
      porcentaje_original: 5, fecha_cierre: tarea.fecha_fin,
      objetivo: 'Recuperar lectura', fecha_limite: hoyIso(), creado: '',
      estado: 'PENDIENTE', progreso: 0, total_acciones: 3, acciones_completadas: 0,
      acciones: ['Leer', 'Resumir', 'Repasar'].map((descripcion, i) => ({
        id: i + 1, orden: i + 1, descripcion, completada: false, completada_en: null,
      })),
    };
    const api = {
      obtenerTarea: vi.fn(() => of(tarea)), listarRecuperaciones: vi.fn(() => of([])),
      crearRecuperacion: vi.fn(() => of(plan)),
      cambiarAccionRecuperacion: vi.fn(() => of(plan)),
    };
    const seguimiento = { recargar: vi.fn() };
    const toast = { create: vi.fn(async () => ({ present: async () => undefined })) };
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['tareaId', '46']]) } } },
      { provide: RetosApi, useValue: api }, { provide: SeguimientoService, useValue: seguimiento },
      { provide: ToastController, useValue: toast },
    ] });
    const pagina = TestBed.runInInjectionContext(() => new RecuperacionPage());
    pagina.form.setValue({ objetivo: 'Recuperar lectura', fecha_limite: hoyIso(), acciones: ['Leer', 'Resumir', 'Repasar'] });
    return { pagina, api, seguimiento, plan };
  }

  it('evita crear dos planes mientras se guarda y conserva la respuesta del servidor', () => {
    const { pagina, api, seguimiento, plan } = preparar();
    const respuesta = new Subject<PlanRecuperacion>();
    api.crearRecuperacion.mockReturnValue(respuesta);
    pagina.crear(); pagina.crear();
    expect(api.crearRecuperacion).toHaveBeenCalledTimes(1);
    expect(pagina.guardando()).toBe(true);
    respuesta.next(plan); respuesta.complete();
    expect(pagina.plan()?.id).toBe(plan.id);
    expect(pagina.guardando()).toBe(false);
    expect(seguimiento.recargar).toHaveBeenCalledTimes(1);
    pagina.crear();
    expect(api.crearRecuperacion).toHaveBeenCalledTimes(1);
  });

  it('conserva lo escrito cuando el servidor rechaza el plan', () => {
    const { pagina, api } = preparar();
    api.crearRecuperacion.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { fecha_limite: ['La fecha límite no puede ser anterior a hoy.'] },
    })));
    pagina.crear();
    expect(pagina.plan()).toBeNull();
    expect(pagina.guardando()).toBe(false);
    expect(pagina.form.getRawValue().objetivo).toBe('Recuperar lectura');
    expect(pagina.acciones.getRawValue()).toEqual(['Leer', 'Resumir', 'Repasar']);
  });

  it('revierte la casilla y no muestra progreso falso si falla el guardado de una acción', () => {
    const { pagina, api, plan } = preparar();
    pagina.plan.set(plan);
    api.cambiarAccionRecuperacion.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const casilla = { checked: true };
    pagina.cambiarAccion(plan.acciones[0], true, casilla);
    expect(casilla.checked).toBe(false);
    expect(pagina.plan()?.progreso).toBe(0);
    expect(pagina.plan()?.acciones[0].completada).toBe(false);
    expect(pagina.accionEnCurso()).toBeNull();
  });
});
