import { Component, OnInit } from '@angular/core';
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
export class HeaderComponent implements OnInit {
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

  async ngOnInit() {
    // Check for redirect result when component initializes
    try {
      const user = await this.firebaseService.handleRedirectResult();
      if (user) {
        console.log('User signed in successfully');
      }
    } catch (error) {
      console.error('Error handling redirect result:', error);
    }
  }

  async signIn(): Promise<void> {
    try {
      await this.firebaseService.signIn();
    } catch (error) {
      console.error('Error in sign in flow:', error);
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