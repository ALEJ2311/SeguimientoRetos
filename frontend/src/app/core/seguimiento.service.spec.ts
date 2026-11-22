import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { TareaSemanal } from './modelos';
import { RetosApi } from './retos-api.service';
import { SeguimientoService } from './seguimiento.service';

describe('cierre reactivo del seguimiento', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('cierra al cambiar el dia, sin recargar datos, y avisa una sola vez', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 22, 23, 59, 30));
    const tarea: TareaSemanal = {
      id: 101, reto: 1, reto_titulo: 'Prueba del reloj', semana: 7,
      fecha_inicio: '2026-11-16', fecha_fin: '2026-11-22',
      descripcion: '', porcentaje: 5, actualizado: '',
    };
    const api = {
      listarRetos: vi.fn(() => of([])),
      listarTareas: vi.fn(() => of([tarea])),
    };
    TestBed.configureTestingModule({ providers: [{ provide: RetosApi, useValue: api }] });
    const servicio = TestBed.inject(SeguimientoService);
    const estados: string[] = [];
    const avisos: number[][] = [];
    const semanas = servicio.semanas$.subscribe((valor) => estados.push(valor[0].semaforo));
    const rojos = servicio.nuevasRojas$.subscribe((valor) => avisos.push(valor.map((s) => s.id)));

    vi.advanceTimersByTime(0);
    expect(estados.at(-1)).toBe('ABIERTA');
    expect(avisos).toEqual([]);

    vi.advanceTimersByTime(60_000);
    expect(estados.at(-1)).toBe('ROJO');
    expect(avisos).toEqual([[101]]);
    expect(api.listarTareas).toHaveBeenCalledTimes(1);

    servicio.recargar();
    vi.advanceTimersByTime(60_000);
    expect(avisos).toEqual([[101]]);

    semanas.unsubscribe();
    rojos.unsubscribe();
  });
});
