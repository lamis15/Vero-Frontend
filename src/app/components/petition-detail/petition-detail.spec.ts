import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PetitionDetail } from './petition-detail';

describe('PetitionDetail', () => {
  let component: PetitionDetail;
  let fixture: ComponentFixture<PetitionDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PetitionDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(PetitionDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
