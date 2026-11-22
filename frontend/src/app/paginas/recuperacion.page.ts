import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardContent,
  IonCardHeader, IonCardSubtitle, IonCardTitle, IonCheckbox, IonContent, IonHeader,
  IonInput, IonItem, IonList, IonNote, IonProgressBar, IonText,
  IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { finalize, forkJoin } from 'rxjs';

import { AccionRecuperacion, PlanRecuperacion, TareaSemanal } from '../core/modelos';
import { RetosApi, mensajeError } from '../core/retos-api.service';
import { COLOR_SEMAFORO, ETIQUETA_SEMAFORO, calcularSemaforo, hoyIso } from '../core/semaforo';
import { SeguimientoService } from '../core/seguimiento.service';

@Component({
  selector: 'app-recuperacion',
  imports: [
    DatePipe, ReactiveFormsModule, IonBackButton, IonBadge, IonButton, IonButtons,
    IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCheckbox,
    IonContent, IonHeader, IonInput, IonItem, IonList, IonNote, IonProgressBar,
    IonText, IonTitle, IonToolbar,
  ],
  styles: `
    ion-card { margin: 12px 0; }
    ion-progress-bar { margin: 12px 0; height: 8px; border-radius: 4px; }
    ion-checkbox { width: 100%; }
    ion-checkbox::part(label) { white-space: normal; }
    .completada { text-decoration: line-through; color: var(--ion-color-medium); }
    .fecha-accion { margin: 4px 0 0 34px; font-size: .85rem; }
    .fila-accion { padding: 12px 0; border-bottom: 1px solid var(--ion-color-light-shade); }
  `,
  template: `
    <ion-header>
      <ion-toolbar color="tertiary">
        <ion-buttons slot="start"><ion-back-button [defaultHref]="volver()"></ion-back-button></ion-buttons>
        <ion-title>Recuperación</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cargar()" [disabled]="cargando() || guardando() || accionEnCurso() !== null">
            Actualizar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (cargando()) {
        <p>Cargando recuperación…</p>
      } @else if (error(); as mensaje) {
        <ion-text color="danger"><p role="alert">{{ mensaje }}</p></ion-text>
        <ion-button (click)="cargar()">Reintentar</ion-button>
      } @else {
        @if (tarea(); as semana) {
          <ion-card>
            <ion-card-header>
              <ion-card-subtitle>{{ semana.reto_titulo }} · Semana {{ semana.semana }}</ion-card-subtitle>
              <ion-card-title>Semana original: {{ semana.porcentaje }} %</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-badge [color]="colorOriginal[estadoOriginal()]">{{ etiquetaOriginal[estadoOriginal()] }}</ion-badge>
              <p>El plan tiene su propio progreso. La semana cerrada conserva su resultado.</p>
            </ion-card-content>
          </ion-card>
        }

        @if (plan(); as recuperacion) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ recuperacion.objetivo }}</ion-card-title>
              <ion-card-subtitle>Fecha límite: {{ fechaTexto(recuperacion.fecha_limite) }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <ion-badge [color]="colores[recuperacion.estado]">{{ estados[recuperacion.estado] }}</ion-badge>
              <h2>{{ recuperacion.progreso }} % del plan</h2>
              <ion-progress-bar [value]="recuperacion.progreso / 100" color="tertiary"></ion-progress-bar>
              <p>{{ recuperacion.acciones_completadas }} de {{ recuperacion.total_acciones }} acciones realizadas</p>
              @if (recuperacion.estado === 'VENCIDO') {
                <ion-text color="danger"><p>El plazo venció. Todavía puedes completar las acciones pendientes.</p></ion-text>
              }
              @if (recuperacion.estado === 'COMPLETADO') {
                <ion-text color="success"><p>Completaste todas las acciones del plan.</p></ion-text>
              }
              @for (accion of recuperacion.acciones; track accion.id) {
                <div class="fila-accion">
                  <ion-checkbox #casilla labelPlacement="end" justify="start"
                    [checked]="accion.completada" [disabled]="accionEnCurso() !== null"
                    (ionChange)="cambiarAccion(accion, $any($event).detail.checked, casilla)">
                    <span [class.completada]="accion.completada">{{ accion.descripcion }}</span>
                  </ion-checkbox>
                  @if (accion.completada_en) {
                    <ion-note><p class="fecha-accion">Realizada el {{ accion.completada_en | date:'dd/MM/yyyy HH:mm' }}</p></ion-note>
                  }
                </div>
              }
            </ion-card-content>
          </ion-card>
        } @else if (puedeCrear()) {
          <h2>Crear plan de recuperación</h2>
          <p>Define qué harás para recuperar esta semana y cuándo lo terminarás.</p>
          <form [formGroup]="form" (ngSubmit)="crear()">
            <ion-list>
              <ion-item>
                <ion-input label="Objetivo de recuperación" labelPlacement="stacked"
                  formControlName="objetivo" [maxlength]="200"></ion-input>
              </ion-item>
              <ion-item>
                <ion-input label="Fecha límite" labelPlacement="stacked" type="date"
                  [min]="hoy" formControlName="fecha_limite"></ion-input>
              </ion-item>
              <div formArrayName="acciones">
                @for (control of acciones.controls; track control; let i = $index) {
                  <ion-item>
                    <ion-input [label]="'Acción ' + (i + 1)" labelPlacement="stacked"
                      [formControlName]="i" [maxlength]="200"></ion-input>
                    <ion-button slot="end" fill="clear" color="medium" type="button"
                      [attr.aria-label]="'Quitar acción ' + (i + 1)"
                      [disabled]="acciones.length === 1 || guardando()" (click)="quitarAccion(i)">Quitar</ion-button>
                  </ion-item>
                }
              </div>
            </ion-list>
            <ion-button type="button" fill="outline" (click)="agregarAccion()"
              [disabled]="acciones.length >= 12 || guardando()">Añadir acción</ion-button>
            <p><ion-note>Incluye entre 1 y 12 acciones diferentes. La fecha límite debe ser hoy o posterior.</ion-note></p>
            <ion-button expand="block" type="submit" color="tertiary" [disabled]="form.invalid || guardando()">
              {{ guardando() ? 'Guardando…' : 'Guardar plan de recuperación' }}
            </ion-button>
          </form>
        } @else {
          <p>Los planes de recuperación se crean para semanas cerradas en rojo, con menos del 10 %.</p>
        }
      }
    </ion-content>
  `,
})
export class RecuperacionPage {
  private readonly api = inject(RetosApi);
  private readonly seguimiento = inject(SeguimientoService);
  private readonly toast = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tareaId = Number(inject(ActivatedRoute).snapshot.paramMap.get('tareaId'));

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly accionEnCurso = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly tarea = signal<TareaSemanal | null>(null);
  readonly plan = signal<PlanRecuperacion | null>(null);
  readonly hoy = hoyIso();
  readonly colorOriginal = COLOR_SEMAFORO;
  readonly etiquetaOriginal = ETIQUETA_SEMAFORO;
  readonly estadoOriginal = computed(() => {
    const tarea = this.tarea();
    return tarea ? calcularSemaforo(tarea.porcentaje, tarea.fecha_inicio, tarea.fecha_fin, this.hoy) : 'PENDIENTE';
  });
  readonly volver = computed(() => this.tarea() ? '/retos/' + this.tarea()!.reto : '/retos');
  readonly puedeCrear = computed(() => {
    return !!this.tarea() && !this.plan() && this.estadoOriginal() === 'ROJO';
  });
  readonly estados = { PENDIENTE: 'Pendiente', EN_RECUPERACION: 'En recuperación', COMPLETADO: 'Completado', VENCIDO: 'Vencido' };
  readonly colores = { PENDIENTE: 'medium', EN_RECUPERACION: 'primary', COMPLETADO: 'success', VENCIDO: 'danger' };
  readonly acciones = new FormArray([this.nuevaAccion(), this.nuevaAccion(), this.nuevaAccion()]);
  readonly form = new FormGroup({
    objetivo: this.nuevaAccion(),
    fecha_limite: new FormControl(this.limiteInicial(), { nonNullable: true, validators: [Validators.required] }),
    acciones: this.acciones,
  });

  constructor() { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({ tarea: this.api.obtenerTarea(this.tareaId), planes: this.api.listarRecuperaciones(this.tareaId) })
      .pipe(finalize(() => this.cargando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tarea, planes }) => { this.tarea.set(tarea); this.plan.set(planes[0] ?? null); },
        error: (e) => this.error.set(this.errorLegible(e)),
      });
  }

  agregarAccion(): void { if (this.acciones.length < 12 && !this.guardando()) this.acciones.push(this.nuevaAccion()); }
  quitarAccion(indice: number): void { if (this.acciones.length > 1 && !this.guardando()) this.acciones.removeAt(indice); }

  crear(): void {
    if (this.form.invalid || this.guardando() || this.plan() || !this.puedeCrear()) return;
    const datos = this.form.getRawValue();
    this.guardando.set(true);
    this.api.crearRecuperacion({
      tarea: this.tareaId, objetivo: datos.objetivo.trim(), fecha_limite: datos.fecha_limite,
      acciones: datos.acciones.map((descripcion) => ({ descripcion: descripcion.trim() })),
    }).pipe(finalize(() => this.guardando.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (plan) => { this.plan.set(plan); this.seguimiento.recargar(); void this.mostrar('Plan de recuperación guardado.', 'success'); },
      error: (e) => void this.mostrar(this.errorLegible(e), 'danger'),
    });
  }

  cambiarAccion(accion: AccionRecuperacion, completada: boolean, control: Pick<IonCheckbox, 'checked'>): void {
    const plan = this.plan();
    if (!plan || this.accionEnCurso() !== null) { control.checked = accion.completada; return; }
    this.accionEnCurso.set(accion.id);
    this.api.cambiarAccionRecuperacion(plan.id, accion.id, completada)
      .pipe(finalize(() => this.accionEnCurso.set(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => { this.plan.set(actualizado); void this.mostrar('Acción guardada. Progreso: ' + actualizado.progreso + ' %.', 'success'); },
        error: (e) => { control.checked = accion.completada; void this.mostrar(this.errorLegible(e), 'danger'); },
      });
  }

  fechaTexto(iso: string): string { return iso.split('-').reverse().join('/'); }

  private nuevaAccion(): FormControl<string> {
    return new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)] });
  }

  private limiteInicial(): string {
    const fecha = new Date(); fecha.setDate(fecha.getDate() + 7); return hoyIso(fecha);
  }

  private errorLegible(error: unknown): string {
    return error instanceof HttpErrorResponse && error.status === 0
      ? 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.' : mensajeError(error);
  }

  private async mostrar(message: string, color: 'success' | 'danger'): Promise<void> {
    await (await this.toast.create({ message, color, duration: 2500 })).present();
  }
}
