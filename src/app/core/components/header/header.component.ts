import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { FirebaseService } from '../../services/firebase.service';
import { ThemeService } from '../../services/theme.service';
import { Observable, map } from 'rxjs';
import { User } from 'firebase/auth';

interface Stats {
  totalLoadouts: number;
  totalUsers: number;
  totalLikes: number;
  newToday: number;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatDividerModule,
    RouterModule
  ]
})
export class HeaderComponent {
  isLoggedIn$: Observable<boolean>;
  user$: Observable<User | null>;
  stats$: Observable<Stats>;
  isStatsLoaded$: Observable<boolean>;
  isDarkTheme$: Observable<boolean>;

  constructor(
    private firebaseService: FirebaseService,
    private themeService: ThemeService
  ) {
    this.isLoggedIn$ = this.firebaseService.isLoggedIn$;
    this.user$ = this.firebaseService.user$;
    this.stats$ = this.firebaseService.stats$;
    this.isStatsLoaded$ = this.stats$.pipe(
      map(stats => stats.totalLoadouts > 0 || stats.totalUsers > 0 || stats.totalLikes > 0)
    );
    this.isDarkTheme$ = this.themeService.isDarkTheme$;
  }

  async signInWithGoogle(): Promise<void> {
    try {
      await this.firebaseService.signInWithGoogle();
    } catch (error) {
      console.error('Error in Google sign in flow:', error);
    }
  }

  async signInAnonymously(): Promise<void> {
    try {
      await this.firebaseService.signInAnonymously();
    } catch (error) {
      console.error('Error in anonymous sign in flow:', error);
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.firebaseService.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
} 