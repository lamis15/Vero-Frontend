import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PetitionComponent } from './petition';

describe('PetitionComponent', () => {
  let component: PetitionComponent;
  let fixture: ComponentFixture<PetitionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PetitionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PetitionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});