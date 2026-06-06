import { Component } from '@angular/core';
import { VotacionComponent } from './components/votacion/votacion';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [VotacionComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent {
  title = 'voto-universitario';
}