import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
} from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { SurveyService } from '../services/survey.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonInput, IonItem, IonLabel],
})
export class Tab3Page implements OnInit {
  loadError = '';
  lookupEmail = '';
  lookupMessage = '';
  isCheckingEmail = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly surveyService: SurveyService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loadError = '';

    try {
      await this.surveyService.loadSurveys();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'No se pudieron cargar estadisticas.';
    }
  }

  get stats() {
    return this.surveyService.getStats();
  }

  get isSurveyor(): boolean {
    return this.authService.currentUser?.role === 'surveyor';
  }

  get genreEntries(): Array<[string, number]> {
    return this.toEntries(this.stats.genres);
  }

  get platformEntries(): Array<[string, number]> {
    return this.toEntries(this.stats.platforms);
  }

  get ageEntries(): Array<[string, number]> {
    return this.toEntries(this.stats.ages);
  }

  get roleEntries(): Array<[string, number]> {
    return this.toEntries(this.stats.roles);
  }

  get completionPercent(): number {
    return Math.min(100, Math.round((this.stats.total / 50) * 100));
  }

  get donutStyle(): string {
    return `conic-gradient(#fff35c 0 ${this.completionPercent}%, #2ee1d2 ${this.completionPercent}% 100%)`;
  }

  get pieStyle(): string {
    const colors = ['#fff35c', '#2ee1d2', '#ff6b9a', '#8c6cff', '#ffffff'];
    let cursor = 0;
    const total = Math.max(this.stats.total, 1);
    const slices = this.roleEntries.map(([role, count], index) => {
      const start = cursor;
      cursor += (count / total) * 100;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    });

    return `conic-gradient(${slices.join(', ') || '#2ee1d2 0 100%'})`;
  }

  get linePoints(): Array<{ x: number; y: number }> {
    return this.ageEntries.map((item, index) => {
      const [x, y] = this.linePoint(index, this.ageEntries.length).split(',').map(Number);
      return { x, y };
    });
  }

  get linePolyline(): string {
    return this.linePoints.map((point) => `${point.x},${point.y}`).join(' ');
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    void this.router.navigateByUrl('/auth', { replaceUrl: true });
  }

  async checkEmailMatch(): Promise<void> {
    this.lookupMessage = '';
    const email = this.lookupEmail.trim().toLowerCase();

    if (!email) {
      this.lookupMessage = 'Escribe un correo para revisar coincidencias.';
      return;
    }

    this.isCheckingEmail = true;

    try {
      const exists = await this.surveyService.hasSurveyForEmail(email);
      this.lookupMessage = exists
        ? 'Ese correo ya tiene una encuesta registrada. No deberias volver a enviarla.'
        : 'No hay encuesta con ese correo. Esa persona aun puede participar.';
    } catch (error) {
      this.lookupMessage = error instanceof Error ? error.message : 'No se pudo revisar el correo.';
    } finally {
      this.isCheckingEmail = false;
    }
  }

  barWidth(value: number): number {
    return Math.max(8, Math.round((value / Math.max(this.stats.total, 1)) * 100));
  }

  private linePoint(index: number, total: number): string {
    const x = total <= 1 ? 50 : 8 + (index / (total - 1)) * 84;
    const y = 72 - ((index + 1) / Math.max(total, 1)) * 46;
    return `${x},${y}`;
  }

  private toEntries(source: Record<string, number>): Array<[string, number]> {
    return Object.entries(source).sort((a, b) => b[1] - a[1]);
  }
}
