import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Votacion } from './votacion';

describe('Votacion', () => {
  let component: Votacion;
  let fixture: ComponentFixture<Votacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Votacion],
    }).compileComponents();

    fixture = TestBed.createComponent(Votacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
