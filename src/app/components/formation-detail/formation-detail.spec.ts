import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormationDetail } from './formation-detail';

describe('FormationDetail', () => {
  let component: FormationDetail;
  let fixture: ComponentFixture<FormationDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormationDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(FormationDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
