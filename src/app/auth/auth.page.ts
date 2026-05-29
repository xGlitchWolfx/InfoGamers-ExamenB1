import { Component } from '@angular/core';
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

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonContent,
    IonInput,
    IonItem,
    IonLabel,
  ],
})
export class AuthPage {
  authError = '';
  isSubmitting = false;
  mode: 'login' | 'register' = 'login';
  name = '';
  email = '';
  password = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  get passwordScore(): number {
    let score = 0;

    if (this.password.length >= 8) score += 1;
    if (/[A-Z]/.test(this.password) && /[a-z]/.test(this.password)) score += 1;
    if (/\d/.test(this.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(this.password)) score += 1;

    if (/^(12345678|password|qwerty|abcdefgh|11111111)$/i.test(this.password)) {
      return 1;
    }

    return score;
  }

  get passwordStrength(): 'facil' | 'medio' | 'seguro' {
    if (this.passwordScore >= 4) return 'seguro';
    if (this.passwordScore >= 2) return 'medio';
    return 'facil';
  }

  get passwordHint(): string {
    if (this.password.length < 8) return 'Minimo 8 caracteres.';
    if (this.passwordStrength === 'facil') return 'Agrega mayusculas, numeros o simbolos.';
    if (this.passwordStrength === 'medio') return 'Bien, pero puede ser mas fuerte.';
    return 'Clave segura.';
  }

  get canSubmit(): boolean {
    const hasLoginFields = this.email.trim().length > 0 && this.password.length > 0;
    if (this.mode === 'login') return hasLoginFields;

    return hasLoginFields && this.name.trim().length > 0 && this.password.length >= 8 && this.passwordScore >= 2;
  }

  setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
  }

  async submit(): Promise<void> {
    if (!this.canSubmit) {
      return;
    }

    this.authError = '';
    this.isSubmitting = true;

    try {
      if (this.mode === 'register') {
        await this.authService.register(this.name, this.email, this.password, 'viewer');
      } else {
        await this.authService.login(this.email, this.password);
      }

      const destination = this.authService.currentUser?.role === 'surveyor' ? '/tabs/tab1' : '/tabs/tab2';
      void this.router.navigateByUrl(destination, { replaceUrl: true });
    } catch (error) {
      this.authError = error instanceof Error ? error.message : 'No se pudo completar la accion.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
