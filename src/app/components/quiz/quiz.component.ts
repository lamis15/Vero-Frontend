import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormationService } from '../../services/formation.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { AnswerDto, QuizResponse, QuizResult } from '../../services/formation.models';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.css'
})
export class QuizComponent implements OnInit {
  formationId: number = 0;
  quiz: QuizResponse | null = null;
  answers: Map<number, number> = new Map();
  loading = true;
  submitting = false;
  result: QuizResult | null = null;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formationService: FormationService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.formationId = +params['id'];
      this.loadQuiz();
    });
  }

  loadQuiz(): void {
    this.loading = true;
    this.formationService.getQuiz(this.formationId).subscribe({
      next: (quiz) => {
        this.quiz = quiz;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 403) {
          this.error = "Accès refusé : vous n'êtes pas participant de cette formation.";
          setTimeout(() => this.router.navigate(['/formations', this.formationId]), 2000);
        } else if (err.status === 409) {
          this.error = "La formation n'est pas encore terminée.";
        } else if (err.status === 404) {
          this.error = "Aucun quiz disponible pour cette formation.";
        } else {
          this.error = "Erreur lors du chargement du quiz.";
        }
      }
    });
  }

  selectOption(questionId: number, optionId: number): void {
    this.answers.set(questionId, optionId);
  }

  isSelected(questionId: number, optionId: number): boolean {
    return this.answers.get(questionId) === optionId;
  }

  allAnswered(): boolean {
    if (!this.quiz) return false;
    return this.answers.size === this.quiz.questions.length;
  }

  submitQuiz(): void {
    if (!this.allAnswered()) {
      this.notificationService.show('Veuillez répondre à toutes les questions', 'warning');
      return;
    }
    this.submitting = true;
    const answerList: AnswerDto[] = Array.from(this.answers.entries()).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId
    }));
    this.formationService.submitQuiz(this.formationId, answerList).subscribe({
      next: (result) => {
        this.result = result;
        this.submitting = false;
      },
      error: (err) => {
        console.error('Error submitting quiz:', err);
        this.notificationService.show('Erreur lors de la soumission du quiz', 'error');
        this.submitting = false;
      }
    });
  }

  downloadCertificate(): void {
    this.formationService.downloadCertificate(this.formationId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'certificat.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading certificate:', err);
        this.notificationService.show('Erreur lors du téléchargement du certificat', 'error');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/formations', this.formationId]);
  }
}
