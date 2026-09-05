# File: snake.py
import pygame
import random
import sys

# Pygame initialize setup
pygame.init()

# Game Constants
WIDTH, HEIGHT = 600, 400
GRID_SIZE = 20
FPS = 12

# Colors
BLACK = (18, 18, 18)
WHITE = (255, 255, 255)
RED = (239, 68, 68)
GREEN = (34, 197, 94)
DARK_GREEN = (21, 128, 61)
GRAY = (38, 38, 38)

# Screen setup
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Classic Snake Game")
clock = pygame.time.Clock()

font = pygame.font.SysFont("arial", 24)
large_font = pygame.font.SysFont("arial", 36, bold=True)

class SnakeGame:
    def __init__(self):
        self.reset()

    def reset(self):
        self.snake = [
            (WIDTH // 2, HEIGHT // 2),
            (WIDTH // 2 - GRID_SIZE, HEIGHT // 2),
            (WIDTH // 2 - (2 * GRID_SIZE), HEIGHT // 2)
        ]
        self.direction = (GRID_SIZE, 0)
        self.next_direction = self.direction
        self.score = 0
        self.game_over = False
        self.spawn_food()

    def spawn_food(self):
        while True:
            x = random.randint(0, (WIDTH - GRID_SIZE) // GRID_SIZE) * GRID_SIZE
            y = random.randint(0, (HEIGHT - GRID_SIZE) // GRID_SIZE) * GRID_SIZE
            self.food = (x, y)
            if self.food not in self.snake:
                break

    def handle_input(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            elif event.type == pygame.KEYDOWN:
                if self.game_over:
                    if event.key == pygame.K_SPACE or event.key == pygame.K_r:
                        self.reset()
                else:
                    if (event.key == pygame.K_UP or event.key == pygame.K_w) and self.direction != (0, GRID_SIZE):
                        self.next_direction = (0, -GRID_SIZE)
                    elif (event.key == pygame.K_DOWN or event.key == pygame.K_s) and self.direction != (0, -GRID_SIZE):
                        self.next_direction = (0, GRID_SIZE)
                    elif (event.key == pygame.K_LEFT or event.key == pygame.K_a) and self.direction != (GRID_SIZE, 0):
                        self.next_direction = (-GRID_SIZE, 0)
                    elif (event.key == pygame.K_RIGHT or event.key == pygame.K_d) and self.direction != (-GRID_SIZE, 0):
                        self.next_direction = (GRID_SIZE, 0)

    def update(self):
        if self.game_over:
            return

        self.direction = self.next_direction
        head_x, head_y = self.snake[0]
        dir_x, dir_y = self.direction
        new_head = (head_x + dir_x, head_y + dir_y)

        # Boundary Collision
        if (new_head[0] < 0 or new_head[0] >= WIDTH or
            new_head[1] < 0 or new_head[1] >= HEIGHT):
            self.game_over = True
            return

        # Self Collision
        if new_head in self.snake:
            self.game_over = True
            return

        self.snake.insert(0, new_head)

        # Food Collision
        if new_head == self.food:
            self.score += 10
            self.spawn_food()
        else:
            self.snake.pop()

    def draw(self):
        screen.fill(BLACK)

        # Draw Grid background
        for x in range(0, WIDTH, GRID_SIZE):
            pygame.draw.line(screen, GRAY, (x, 0), (x, HEIGHT), 1)
        for y in range(0, HEIGHT, GRID_SIZE):
            pygame.draw.line(screen, GRAY, (0, y), (WIDTH, y), 1)

        # Draw Food
        food_rect = pygame.Rect(self.food[0], self.food[1], GRID_SIZE - 2, GRID_SIZE - 2)
        pygame.draw.rect(screen, RED, food_rect, border_radius=4)

        # Draw Snake
        for idx, segment in enumerate(self.snake):
            color = DARK_GREEN if idx == 0 else GREEN
            segment_rect = pygame.Rect(segment[0], segment[1], GRID_SIZE - 2, GRID_SIZE - 2)
            pygame.draw.rect(screen, color, segment_rect, border_radius=3)

        # Render Score
        score_surface = font.render(f"Score: {self.score}", True, WHITE)
        screen.blit(score_surface, (10, 10))

        # Game Over Screen
        if self.game_over:
            overlay = pygame.Surface((WIDTH, HEIGHT))
            overlay.set_alpha(180)
            overlay.fill(BLACK)
            screen.blit(overlay, (0, 0))

            over_text = large_font.render("GAME OVER", True, RED)
            score_final = font.render(f"Final Score: {self.score}", True, WHITE)
            restart_text = font.render("Press SPACE or R to Restart", True, WHITE)

            screen.blit(over_text, (WIDTH // 2 - over_text.get_width() // 2, HEIGHT // 3))
            screen.blit(score_final, (WIDTH // 2 - score_final.get_width() // 2, HEIGHT // 2))
            screen.blit(restart_text, (WIDTH // 2 - restart_text.get_width() // 2, HEIGHT // 2 + 40))

        pygame.display.flip()

    def run(self):
        while True:
            self.handle_input()
            self.update()
            self.draw()
            clock.tick(FPS)

if __name__ == "__main__":
    game = SnakeGame()
    game.run()