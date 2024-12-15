import { TestBed } from '@angular/core/testing';

import { OsrsApiService } from './osrs-api.service';

describe('OsrsApiService', () => {
  let service: OsrsApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OsrsApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
