import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
} from '@ionic/angular/standalone';
import { SurveyRecord, SurveyService } from '../services/survey.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonInput,
    IonItem,
    IonLabel,
  ],
})
export class Tab2Page implements OnInit {
  private readonly quitoCenter = { latitude: -0.1807, longitude: -78.4678 };
  private readonly quitoZoom = 12;
  private readonly quitoTileSpan = 3;
  private readonly worldZoom = 2;
  private readonly worldTileSpan = 2 ** this.worldZoom;

  loadError = '';
  query = '';
  worldTiles = this.buildWorldTiles();
  quitoTiles = this.buildQuitoTiles();

  constructor(private readonly surveyService: SurveyService) {}

  async ngOnInit(): Promise<void> {
    await this.loadRecords();
  }

  async loadRecords(): Promise<void> {
    this.loadError = '';

    try {
      await this.surveyService.loadSurveys();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'No se pudieron cargar resultados.';
    }
  }

  get records(): SurveyRecord[] {
    const normalizedQuery = this.query.toLowerCase().trim();
    if (!normalizedQuery) {
      return this.surveyService.surveys;
    }

    return this.surveyService.surveys.filter((survey) =>
      [survey.alias, survey.favoriteGame, survey.genre, survey.platform, survey.place]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }

  worldPinLeft(record: SurveyRecord): number {
    const point = this.toTilePoint(record.latitude, record.longitude, this.worldZoom);
    return this.clampPercent((point.x / this.worldTileSpan) * 100);
  }

  worldPinTop(record: SurveyRecord): number {
    const point = this.toTilePoint(record.latitude, record.longitude, this.worldZoom);
    return this.clampPercent((point.y / this.worldTileSpan) * 100);
  }

  quitoPinLeft(record: SurveyRecord): number {
    const origin = this.quitoTileOrigin();
    const point = this.toTilePoint(record.latitude, record.longitude, this.quitoZoom);
    return ((point.x - origin.x) / this.quitoTileSpan) * 100;
  }

  quitoPinTop(record: SurveyRecord): number {
    const origin = this.quitoTileOrigin();
    const point = this.toTilePoint(record.latitude, record.longitude, this.quitoZoom);
    return ((point.y - origin.y) / this.quitoTileSpan) * 100;
  }

  isInQuitoMap(record: SurveyRecord): boolean {
    const left = this.quitoPinLeft(record);
    const top = this.quitoPinTop(record);
    return left >= 0 && left <= 100 && top >= 0 && top <= 100;
  }

  googleMapsUrl(record: SurveyRecord): string {
    return `https://www.google.com/maps/search/?api=1&query=${record.latitude},${record.longitude}`;
  }

  openInGoogleMaps(record: SurveyRecord): void {
    window.open(this.googleMapsUrl(record), '_blank', 'noopener,noreferrer');
  }

  private buildWorldTiles(): Array<{ url: string; left: number; top: number; size: number }> {
    const tiles = [];
    const size = 100 / this.worldTileSpan;

    for (let y = 0; y < this.worldTileSpan; y += 1) {
      for (let x = 0; x < this.worldTileSpan; x += 1) {
        tiles.push({
          url: this.osmTileUrl(this.worldZoom, x, y),
          left: x * size,
          top: y * size,
          size,
        });
      }
    }

    return tiles;
  }

  private buildQuitoTiles(): Array<{ url: string; left: number; top: number; size: number }> {
    const origin = this.quitoTileOrigin();
    const tiles = [];
    const size = 100 / this.quitoTileSpan;

    for (let y = 0; y < this.quitoTileSpan; y += 1) {
      for (let x = 0; x < this.quitoTileSpan; x += 1) {
        tiles.push({
          url: this.osmTileUrl(this.quitoZoom, origin.x + x, origin.y + y),
          left: x * size,
          top: y * size,
          size,
        });
      }
    }

    return tiles;
  }

  private quitoTileOrigin(): { x: number; y: number } {
    const center = this.toTilePoint(this.quitoCenter.latitude, this.quitoCenter.longitude, this.quitoZoom);
    return {
      x: Math.floor(center.x) - 1,
      y: Math.floor(center.y) - 1,
    };
  }

  private osmTileUrl(zoom: number, x: number, y: number): string {
    return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
  }

  private toTilePoint(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
    const n = 2 ** zoom;
    const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    const latitudeRadians = clampedLatitude * Math.PI / 180;

    return {
      x: ((longitude + 180) / 360) * n,
      y: (
        1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI
      ) / 2 * n,
    };
  }

  private clampPercent(value: number): number {
    return Math.max(0, Math.min(100, value));
  }
}
