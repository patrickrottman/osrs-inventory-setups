import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebase.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatMenuModule]
})
export class AuthComponent {
  user$ = this.firebaseService.currentUser$;

  constructor(private firebaseService: FirebaseService) {}

  async signInWithGoogle(): Promise<void> {
    await this.firebaseService.signInWithGoogle();
  }

  async signInAnonymously(): Promise<void> {
    await this.firebaseService.signInAnonymously();
  }

  async signOut(): Promise<void> {
    await this.firebaseService.signOut();
  }
}
