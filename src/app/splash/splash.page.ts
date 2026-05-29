import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  imports: [IonContent],
})
export class SplashPage implements OnInit {
  isLeaving = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.authService.initialize();

    setTimeout(() => {
      this.isLeaving = true;
      setTimeout(() => {
        const destination = user ? '/tabs/tab1' : '/auth';

        void this.router.navigateByUrl(destination, { replaceUrl: true });
      }, 900);
    }, 5000);
  }
}
