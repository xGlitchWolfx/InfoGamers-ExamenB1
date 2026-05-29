import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

export interface SurveyRecord {
  id: string;
  userId?: string;
  respondentEmail: string;
  alias: string;
  ageRange: string;
  role: string;
  favoriteGame: string;
  platform: string;
  genre: string;
  place: string;
  latitude: number;
  longitude: number;
  locationAccuracy: 'precise' | 'approximate';
  comment: string;
  imageUrl: string;
  createdAt: string;
  gameInfo: {
    title: string;
    genre: string;
    platform: string;
    rating: string;
  };
}

type SurveyInput = Omit<SurveyRecord, 'id' | 'createdAt' | 'gameInfo'> & {
  gameInfo?: SurveyRecord['gameInfo'];
};

interface SurveyRow {
  id: string;
  user_id?: string;
  respondent_email?: string;
  alias: string;
  age_range: string;
  role: string;
  favorite_game: string;
  platform: string;
  genre: string;
  place?: string;
  latitude?: number;
  longitude?: number;
  location_accuracy?: 'precise' | 'approximate';
  comment: string;
  image_url: string;
  game_title: string;
  game_genre: string;
  game_platform: string;
  game_rating: string;
  created_at: string;
}

const INITIAL_SURVEYS: SurveyRecord[] = [
  {
    id: 'demo-1',
    respondentEmail: 'demo@infogamers.app',
    alias: 'Alex',
    ageRange: '18 - 24',
    role: 'Estudiante',
    favoriteGame: 'Valorant',
    platform: 'PC',
    genre: 'Accion',
    place: 'Universidad',
    latitude: -2.170998,
    longitude: -79.922359,
    locationAccuracy: 'approximate',
    comment: 'Le gusta jugar con amigos despues de clases.',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date().toISOString(),
    gameInfo: {
      title: 'Valorant',
      genre: 'Shooter tactico',
      platform: 'PC',
      rating: '4.6',
    },
  },
];

@Injectable({
  providedIn: 'root',
})
export class SurveyService {
  private surveyCache: SurveyRecord[] = INITIAL_SURVEYS;

  constructor(
    private readonly authService: AuthService,
    private readonly supabase: SupabaseService,
  ) {}

  get surveys(): SurveyRecord[] {
    return this.surveyCache;
  }

  async loadSurveys(options: { includeLocation?: boolean } = {}): Promise<SurveyRecord[]> {
    const selectColumns = options.includeLocation
      ? '*'
      : [
          'id',
          'user_id',
          'respondent_email',
          'alias',
          'age_range',
          'role',
          'favorite_game',
          'platform',
          'genre',
          'comment',
          'image_url',
          'game_title',
          'game_genre',
          'game_platform',
          'game_rating',
          'created_at',
        ].join(',');

    const { data, error } = await this.supabase.client
      .from('surveys')
      .select(selectColumns)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    this.surveyCache = (data || []).map((row) => this.fromRow(row as unknown as SurveyRow));
    return this.surveyCache;
  }

  async addSurvey(record: SurveyInput): Promise<SurveyRecord> {
    const user = this.authService.currentUser;

    if (!user) {
      throw new Error('Debes iniciar sesion para guardar encuestas.');
    }

    const gameInfo = record.gameInfo || this.buildGameInfo(record.favoriteGame, record.genre, record.platform);
    const imageUrl = await this.resolveImageUrl(record.imageUrl, user.id);
    const respondentEmail = this.normalizeEmail(record.respondentEmail);
    const { data, error } = await this.supabase.client
      .from('surveys')
      .insert({
        user_id: user.id,
        respondent_email: respondentEmail,
        alias: record.alias,
        age_range: record.ageRange,
        role: record.role,
        favorite_game: record.favoriteGame,
        platform: record.platform,
        genre: record.genre,
        place: record.place,
        latitude: record.latitude,
        longitude: record.longitude,
        location_accuracy: record.locationAccuracy,
        comment: record.comment,
        image_url: imageUrl,
        game_title: gameInfo.title,
        game_genre: gameInfo.genre,
        game_platform: gameInfo.platform,
        game_rating: gameInfo.rating,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const survey = this.fromRow(data as SurveyRow);
    this.surveyCache = [survey, ...this.surveyCache.filter((item) => item.id !== 'demo-1')];
    return survey;
  }

  async hasCurrentUserSubmitted(): Promise<boolean> {
    const user = this.authService.currentUser;
    if (!user) {
      return false;
    }

    const { data, error } = await this.supabase.client
      .from('surveys')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return Boolean(data?.length);
  }

  async hasSurveyForEmail(email: string): Promise<boolean> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return false;
    }

    const { data, error } = await this.supabase.client
      .from('surveys')
      .select('id')
      .eq('respondent_email', normalizedEmail)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return Boolean(data?.length);
  }

  getStats() {
    const surveys = this.surveys;
    const uniqueGames = new Set(surveys.map((survey) => survey.favoriteGame.toLowerCase()));
    const platforms = this.countBy(surveys, 'platform');
    const genres = this.countBy(surveys, 'genre');
    const roles = this.countBy(surveys, 'role');
    const ages = this.countBy(surveys, 'ageRange');

    return {
      total: surveys.length,
      games: uniqueGames.size,
      photos: surveys.filter((survey) => survey.imageUrl).length,
      topPlatform: this.topValue(platforms),
      topGenre: this.topValue(genres),
      platforms,
      genres,
      roles,
      ages,
    };
  }

  private async resolveImageUrl(imageUrl: string, userId: string): Promise<string> {
    if (!imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    const blob = this.dataUrlToBlob(imageUrl);
    const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    const path = `surveys/${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.supabase.client.storage
      .from('survey-photos')
      .upload(path, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = this.supabase.client.storage
      .from('survey-photos')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const [metadata, data] = dataUrl.split(',');
    const mime = metadata.match(/data:(.*);base64/)?.[1] || 'image/jpeg';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mime });
  }

  private fromRow(row: SurveyRow): SurveyRecord {
    return {
      id: row.id,
      userId: row.user_id,
      respondentEmail: row.respondent_email || '',
      alias: row.alias,
      ageRange: row.age_range,
      role: row.role,
      favoriteGame: row.favorite_game,
      platform: row.platform,
      genre: row.genre,
      place: row.place || '',
      latitude: Number(row.latitude || 0),
      longitude: Number(row.longitude || 0),
      locationAccuracy: row.location_accuracy || 'precise',
      comment: row.comment,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      gameInfo: {
        title: row.game_title,
        genre: row.game_genre,
        platform: row.game_platform,
        rating: row.game_rating,
      },
    };
  }

  private buildGameInfo(title: string, genre: string, platform: string) {
    return {
      title,
      genre,
      platform,
      rating: 'Sin rating',
    };
  }

  private countBy(records: SurveyRecord[], key: keyof SurveyRecord): Record<string, number> {
    return records.reduce((result, record) => {
      const value = String(record[key] || 'Sin dato');
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
  }

  private topValue(counts: Record<string, number>): string {
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin datos';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
