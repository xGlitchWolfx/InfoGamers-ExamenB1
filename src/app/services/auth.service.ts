import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'surveyor' | 'viewer';
}

const AUTH_KEY = 'infogamers-auth-user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userCache: AppUser | null = this.readCachedUser();

  constructor(private readonly supabase: SupabaseService) {}

  get currentUser(): AppUser | null {
    return this.userCache;
  }

  get isLoggedIn(): boolean {
    return Boolean(this.userCache);
  }

  async initialize(): Promise<AppUser | null> {
    const { data } = await this.supabase.client.auth.getSession();
    const authUser = data.session?.user;

    if (!authUser?.email) {
      this.setCachedUser(null);
      return null;
    }

    const profile = await this.fetchProfile(authUser.id);
    const appUser: AppUser = {
      id: authUser.id,
      email: authUser.email,
      name: profile?.name || authUser.email.split('@')[0] || 'Usuario',
      role: profile?.role || 'viewer',
    };
    this.setCachedUser(appUser);
    return appUser;
  }

  async login(email: string, password: string): Promise<AppUser> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user?.email) {
      throw new Error(error?.message || 'No se pudo iniciar sesion.');
    }

    const profile = await this.fetchProfile(data.user.id);
    const appUser: AppUser = {
      id: data.user.id,
      email: data.user.email,
      name: profile?.name || data.user.email.split('@')[0] || 'Usuario',
      role: profile?.role || 'viewer',
    };
    this.setCachedUser(appUser);
    return appUser;
  }

  async register(name: string, email: string, password: string, role: AppUser['role'] = 'viewer'): Promise<AppUser> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
    });

    if (error || !data.user?.email) {
      throw new Error(error?.message || 'No se pudo crear la cuenta.');
    }

    const appUser: AppUser = {
      id: data.user.id,
      email: data.user.email,
      name: name.trim() || data.user.email.split('@')[0] || 'Usuario',
      role,
    };

    const { error: profileError } = await this.supabase.client
      .from('profiles')
      .upsert({
        id: appUser.id,
        name: appUser.name,
        role: appUser.role,
      });

    if (profileError) {
      throw new Error(profileError.message);
    }

    this.setCachedUser(appUser);
    return appUser;
  }

  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.setCachedUser(null);
  }

  private async fetchProfile(id: string): Promise<{ name: string; role: AppUser['role'] } | null> {
    const { data } = await this.supabase.client
      .from('profiles')
      .select('name, role')
      .eq('id', id)
      .maybeSingle();

    if (!data) {
      return null;
    }

    return {
      name: data.name,
      role: data.role,
    };
  }

  private setCachedUser(user: AppUser | null): void {
    this.userCache = user;
    if (user) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }

  private readCachedUser(): AppUser | null {
    const savedUser = localStorage.getItem(AUTH_KEY);
    return savedUser ? JSON.parse(savedUser) as AppUser : null;
  }
}
