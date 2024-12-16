import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebase.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule]
})
export class AuthComponent {
  user$ = this.firebaseService.currentUser$;

  constructor(private firebaseService: FirebaseService) {}

  async signIn(): Promise<void> {
    await this.firebaseService.signIn();
  }

  async signOut(): Promise<void> {
    await this.firebaseService.signOut();
  }
}
