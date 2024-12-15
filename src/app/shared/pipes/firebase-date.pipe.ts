import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Timestamp, FieldValue } from 'firebase/firestore';

@Pipe({
  name: 'firebaseDate',
  standalone: true
})
export class FirebaseDatePipe implements PipeTransform {
  constructor(private datePipe: DatePipe) {}

  transform(value: Date | Timestamp | FieldValue | null | undefined, format = 'mediumDate'): string | null {
    if (!value) return null;
    
    if (value instanceof Date) {
      return this.datePipe.transform(value, format);
    }
    
    if (value instanceof Timestamp) {
      return this.datePipe.transform(value.toDate(), format);
    }

    // For serverTimestamp() values that haven't been written yet
    return this.datePipe.transform(new Date(), format);
  }
} 