import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { GameApiResult, RawgService } from '../services/rawg.service';
import { SurveyService } from '../services/survey.service';

type LocationAccuracy = 'precise' | 'approximate';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonContent,
    IonInput,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonTextarea,
  ],
})
export class Tab1Page implements OnInit {
  @ViewChild('cameraInput') private readonly cameraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('galleryInput') private readonly galleryInput?: ElementRef<HTMLInputElement>;

  apiError = '';
  captureError = '';
  saveError = '';
  isSaving = false;
  gamePreview: GameApiResult | null = null;
  isCapturingPhoto = false;
  isGettingLocation = false;
  isSearchingGame = false;
  isCheckingSubmission = true;
  userHasSubmitted = false;
  private browserPhotoSource: 'camera' | 'gallery' = 'gallery';

  form = {
    respondentEmail: '',
    alias: '',
    ageRange: '18 - 24',
    role: 'Estudiante',
    favoriteGame: '',
    platform: 'Movil',
    genre: 'Accion',
    place: '',
    latitude: -2.170998,
    longitude: -79.922359,
    locationAccuracy: 'approximate' as LocationAccuracy,
    comment: '',
    imageUrl: '',
  };

  constructor(
    public readonly authService: AuthService,
    private readonly rawgService: RawgService,
    private readonly surveyService: SurveyService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.form.respondentEmail = this.authService.currentUser?.email || '';
    await this.refreshSubmissionStatus();
  }

  get isSurveyor(): boolean {
    return this.authService.currentUser?.role === 'surveyor';
  }

  get shouldShowThankYou(): boolean {
    return !this.isSurveyor && this.userHasSubmitted;
  }

  async refreshSubmissionStatus(): Promise<void> {
    this.isCheckingSubmission = true;
    this.saveError = '';

    try {
      this.userHasSubmitted = await this.surveyService.hasCurrentUserSubmitted();
    } catch (error) {
      this.saveError = error instanceof Error ? error.message : 'No se pudo revisar tu participacion.';
    } finally {
      this.isCheckingSubmission = false;
    }
  }

  async chooseCameraPhoto(): Promise<void> {
    await this.takePhoto(CameraSource.Camera);
  }

  async chooseGalleryPhoto(): Promise<void> {
    await this.takePhoto(CameraSource.Photos);
  }

  useApiImage(): void {
    if (!this.gamePreview?.imageUrl) {
      this.captureError = 'Primero busca el juego para usar la imagen de RAWG.';
      return;
    }

    this.captureError = '';
    this.form.imageUrl = this.gamePreview.imageUrl;
  }

  onPhotoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.isCapturingPhoto = false;

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.captureError = 'Selecciona una imagen valida.';
      input.value = '';
      return;
    }

    this.loadCompressedImage(file)
      .then((dataUrl) => {
        this.form.imageUrl = dataUrl;
        input.value = '';
      })
      .catch(() => {
        this.captureError = 'No se pudo cargar la foto seleccionada.';
        input.value = '';
      });
  }

  async searchGame(): Promise<void> {
    this.apiError = '';
    this.gamePreview = null;
    this.isSearchingGame = true;

    try {
      const result = await this.rawgService.searchGame(this.form.favoriteGame);
      if (!result) {
        this.apiError = 'No se encontro informacion para ese juego.';
        return;
      }

      this.gamePreview = result;
      this.form.genre = result.formGenre;
      this.form.platform = result.formPlatform;
    } catch (error) {
      this.apiError = error instanceof Error
        ? error.message
        : 'No se pudo consultar RAWG. Revisa internet o la API key.';
    } finally {
      this.isSearchingGame = false;
    }
  }

  async saveSurvey(): Promise<void> {
    this.saveError = '';
    this.captureError = '';

    if (this.shouldShowThankYou) {
      this.saveError = 'Ya enviaste tu encuesta. Gracias por participar.';
      return;
    }

    this.isSaving = true;

    try {
      if (this.form.favoriteGame && !this.gamePreview) {
        await this.searchGame();
      }

      if (this.isSurveyor && this.form.respondentEmail) {
        const emailAlreadyUsed = await this.surveyService.hasSurveyForEmail(this.form.respondentEmail);
        if (emailAlreadyUsed) {
          throw new Error('Ese correo ya tiene una encuesta registrada.');
        }
      }

      if (!this.isSurveyor) {
        const currentUserAlreadySubmitted = await this.surveyService.hasCurrentUserSubmitted();
        if (currentUserAlreadySubmitted) {
          this.userHasSubmitted = true;
          throw new Error('Ya enviaste tu encuesta. Gracias por participar.');
        }
      }

      if (!this.form.imageUrl) {
        throw new Error('Selecciona una imagen antes de enviar la encuesta.');
      }

      await this.captureLocationForSubmit();

      await this.surveyService.addSurvey({
        ...this.form,
        respondentEmail: this.normalizedRespondentEmail(),
        gameInfo: this.gamePreview?.gameInfo,
      });

      if (this.isSurveyor) {
        this.resetFormForNextSurvey();
      } else {
        this.userHasSubmitted = true;
      }
    } catch (error) {
      this.saveError = error instanceof Error ? error.message : 'No se pudo guardar la encuesta.';
    } finally {
      this.isSaving = false;
    }
  }

  private async takePhoto(source: CameraSource): Promise<void> {
    this.captureError = '';
    this.isCapturingPhoto = true;

    try {
      if (!Capacitor.isNativePlatform()) {
        this.browserPhotoSource = source === CameraSource.Camera ? 'camera' : 'gallery';
        const input = this.browserPhotoSource === 'camera' ? this.cameraInput : this.galleryInput;
        input?.nativeElement.click();
        return;
      }

      const permission = await Camera.requestPermissions({
        permissions: ['camera', 'photos'],
      });

      if (source === CameraSource.Camera && permission.camera === 'denied') {
        this.captureError = 'Permiso de camara denegado.';
        return;
      }

      if (source === CameraSource.Photos && permission.photos === 'denied') {
        this.captureError = 'Permiso de galeria denegado.';
        return;
      }

      const photo = await Camera.getPhoto({
        allowEditing: false,
        correctOrientation: true,
        height: 800,
        quality: 45,
        resultType: CameraResultType.DataUrl,
        source,
        width: 800,
      });

      if (photo.dataUrl) {
        this.form.imageUrl = photo.dataUrl;
      }
    } catch {
      this.captureError = 'No se pudo tomar o seleccionar la foto.';
    } finally {
      this.isCapturingPhoto = false;
    }
  }

  private async captureLocationForSubmit(): Promise<void> {
    this.isGettingLocation = true;

    try {
      const position = Capacitor.isNativePlatform()
        ? await this.takeNativeLocation()
        : await this.takeBrowserLocation();
      const coords = this.form.locationAccuracy === 'approximate'
        ? this.toApproximateLocation(position.latitude, position.longitude)
        : position;

      this.form.latitude = coords.latitude;
      this.form.longitude = coords.longitude;
    } finally {
      this.isGettingLocation = false;
    }
  }

  private async takeNativeLocation(): Promise<{ latitude: number; longitude: number }> {
    const permission = await Geolocation.requestPermissions();
    if (permission.location === 'denied') {
      throw new Error('Permiso de ubicacion denegado.');
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: this.form.locationAccuracy === 'precise',
      timeout: 12000,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }

  private async takeBrowserLocation(): Promise<{ latitude: number; longitude: number }> {
    if (!('geolocation' in navigator)) {
      throw new Error('El navegador no tiene geolocalizacion disponible.');
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: this.form.locationAccuracy === 'precise',
        maximumAge: 0,
        timeout: 12000,
      });
    }).catch((error) => {
      throw new Error(this.getLocationErrorMessage(error));
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }

  private toApproximateLocation(latitude: number, longitude: number): { latitude: number; longitude: number } {
    return {
      latitude: Number(latitude.toFixed(2)),
      longitude: Number(longitude.toFixed(2)),
    };
  }

  private normalizedRespondentEmail(): string {
    const fallbackEmail = this.authService.currentUser?.email || '';
    return (this.form.respondentEmail || fallbackEmail).trim().toLowerCase();
  }

  private resetFormForNextSurvey(): void {
    this.form = {
      ...this.form,
      respondentEmail: '',
      alias: '',
      favoriteGame: '',
      place: '',
      comment: '',
      imageUrl: '',
    };
    this.gamePreview = null;
  }

  private async loadCompressedImage(file: File): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject();
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    return this.compressImageDataUrl(dataUrl);
  }

  private async compressImageDataUrl(dataUrl: string): Promise<string> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = dataUrl;
    });

    const maxSize = 800;
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return dataUrl;
    }

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.52);
  }

  private getLocationErrorMessage(error: unknown): string {
    if (this.isBrowserLocationError(error)) {
      if (error.code === 1) {
        return 'Permiso de ubicacion denegado en el navegador.';
      }

      if (error.code === 2) {
        return 'La ubicacion no esta disponible en este dispositivo.';
      }

      if (error.code === 3) {
        return 'La ubicacion tardo demasiado. Intenta otra vez.';
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'No se pudo tomar la ubicacion actual.';
  }

  private isBrowserLocationError(error: unknown): error is GeolocationPositionError {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && typeof (error as { code: unknown }).code === 'number';
  }
}
