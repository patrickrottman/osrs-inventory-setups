import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FirebaseService } from '../../../../core/services/firebase.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoadoutUploaderDialogComponent } from './loadout-uploader-dialog.component';

@Component({
  selector: 'app-loadout-uploader',
  template: '',
  standalone: true,
  imports: [CommonModule]
})
export class LoadoutUploaderComponent {
  constructor(
    private firebaseService: FirebaseService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    // Open dialog immediately when component is created
    this.openUploadDialog();
  }

  openUploadDialog() {
    const dialogRef = this.dialog.open(LoadoutUploaderDialogComponent, {
      width: '90vw',
      maxWidth: '1400px',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Dialog component now handles the upload
        this.snackBar.open('Loadout saved successfully!', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      }
    });
  }
} 