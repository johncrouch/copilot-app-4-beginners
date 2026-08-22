import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getAllCategories,
    getAllPublishers,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('returns categories ordered by name', async () => {
        await seedGames(db, 2);
        await db.insert(categories).values({ name: 'Adventure', description: 'cat' });
        const allCategories = await getAllCategories(db);
        expect(allCategories.map((category) => category.name)).toEqual(['Adventure', 'Strategy']);
    });

    it('returns publishers ordered by name', async () => {
        await seedGames(db, 2);
        await db.insert(publishers).values({ name: 'Pub Zero', description: 'pub' });
        const allPublishers = await getAllPublishers(db);
        expect(allPublishers.map((publisher) => publisher.name)).toEqual(['Pub One', 'Pub Zero']);
    });

    it('filters games by category and publisher', async () => {
        const [strategy] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'cat' })
            .returning({ id: categories.id });
        const [adventure] = await db
            .insert(categories)
            .values({ name: 'Adventure', description: 'cat' })
            .returning({ id: categories.id });
        const [pubOne] = await db
            .insert(publishers)
            .values({ name: 'Pub One', description: 'pub' })
            .returning({ id: publishers.id });
        const [pubTwo] = await db
            .insert(publishers)
            .values({ name: 'Pub Two', description: 'pub' })
            .returning({ id: publishers.id });

        await db.insert(games).values([
            { title: 'Alpha', description: 'A', starRating: 4.1, categoryId: strategy.id, publisherId: pubOne.id },
            { title: 'Beta', description: 'B', starRating: 4.1, categoryId: strategy.id, publisherId: pubTwo.id },
            { title: 'Gamma', description: 'C', starRating: 4.1, categoryId: adventure.id, publisherId: pubOne.id },
        ]);

        const categoryGames = await getFilteredGames(db, { categoryId: strategy.id });
        expect(categoryGames.map((game) => game.title)).toEqual(['Alpha', 'Beta']);

        const publisherGames = await getFilteredGames(db, { publisherId: pubOne.id });
        expect(publisherGames.map((game) => game.title)).toEqual(['Alpha', 'Gamma']);

        const combinedGames = await getFilteredGames(db, { categoryId: strategy.id, publisherId: pubOne.id });
        expect(combinedGames.map((game) => game.title)).toEqual(['Alpha']);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
