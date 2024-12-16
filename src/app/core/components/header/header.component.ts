import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { FirebaseService } from '../../services/firebase.service';
import { ThemeService } from '../../services/theme.service';
import { Observable, take } from 'rxjs';
import { map } from 'rxjs';

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
    RouterModule
  ]
})
export class HeaderComponent {
  stats$: Observable<Stats>;
  isStatsLoaded$: Observable<boolean>;
  isDarkTheme$: Observable<boolean>;

  constructor(
    private firebaseService: FirebaseService,
    private themeService: ThemeService
  ) {
    // Check if user is already logged in, if not sign in anonymously
    this.firebaseService.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.firebaseService.signInAnonymously().catch(error => {
          console.error('Error in anonymous sign in:', error);
        });
      }
    });

    this.stats$ = this.firebaseService.stats$;
    this.isStatsLoaded$ = this.stats$.pipe(
      map(stats => stats.totalLoadouts > 0 || stats.totalUsers > 0 || stats.totalLikes > 0)
    );
    this.isDarkTheme$ = this.themeService.isDarkTheme$;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
} 