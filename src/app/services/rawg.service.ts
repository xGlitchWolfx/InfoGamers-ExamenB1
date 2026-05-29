import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { SurveyRecord } from './survey.service';

interface RawgGameResult {
  name: string;
  background_image: string | null;
  rating: number;
  genres: Array<{ name: string }>;
  platforms: Array<{ platform: { name: string } }>;
}

export interface GameApiResult {
  imageUrl: string;
  gameInfo: SurveyRecord['gameInfo'];
  formGenre: string;
  formPlatform: string;
}

@Injectable({
  providedIn: 'root',
})
export class RawgService {
  async searchGame(query: string): Promise<GameApiResult | null> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return null;
    }

    const params = new URLSearchParams({
      key: environment.rawgApiKey,
      search: trimmedQuery,
      page_size: '1',
      search_precise: 'true',
    });
    const response = await fetch(`https://api.rawg.io/api/games?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RAWG respondio ${response.status}: ${errorText.slice(0, 120)}`);
    }

    const payload = await response.json() as { results: RawgGameResult[] };
    const game = payload.results[0];

    if (!game) {
      return null;
    }

    return {
      imageUrl: game.background_image || '',
      gameInfo: {
        title: game.name,
        genre: game.genres[0]?.name || 'Sin genero',
        platform: game.platforms[0]?.platform.name || 'Sin plataforma',
        rating: String(game.rating || 'Sin rating'),
      },
      formGenre: this.mapGenre(game.genres[0]?.name),
      formPlatform: this.mapPlatform(game.platforms.map((entry) => entry.platform.name)),
    };
  }

  private mapGenre(genre = ''): string {
    const normalizedGenre = genre.toLowerCase();

    if (normalizedGenre.includes('adventure')) return 'Aventura';
    if (normalizedGenre.includes('sports')) return 'Deportes';
    if (normalizedGenre.includes('strategy')) return 'Estrategia';
    if (normalizedGenre.includes('role-playing') || normalizedGenre.includes('rpg')) return 'RPG';
    if (normalizedGenre.includes('horror')) return 'Terror';
    if (normalizedGenre.includes('simulation')) return 'Simulacion';
    if (normalizedGenre.includes('action') || normalizedGenre.includes('shooter')) return 'Accion';

    return 'Otro';
  }

  private mapPlatform(platforms: string[]): string {
    const normalizedPlatforms = platforms.join(' ').toLowerCase();

    if (normalizedPlatforms.includes('android') || normalizedPlatforms.includes('ios')) return 'Movil';
    if (normalizedPlatforms.includes('pc') || normalizedPlatforms.includes('mac') || normalizedPlatforms.includes('linux')) return 'PC';
    if (normalizedPlatforms.includes('web')) return 'Navegador';
    if (normalizedPlatforms.includes('xbox') || normalizedPlatforms.includes('playstation') || normalizedPlatforms.includes('nintendo')) return 'Consola';

    return 'Otro';
  }
}
