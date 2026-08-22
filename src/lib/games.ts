import { and, asc, eq } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Get all games ordered by title.
 *
 * @param db - Injectable Drizzle database used by pages and tests.
 * @returns Games with their optional category and publisher relations.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Get all categories ordered by name.
 *
 * @param db - Injectable Drizzle database used by pages and tests.
 * @returns Categories sorted for deterministic filter controls.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows;
}

/**
 * Get all publishers ordered by name.
 *
 * @param db - Injectable Drizzle database used by pages and tests.
 * @returns Publishers sorted for deterministic filter controls.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows;
}

/**
 * Get games filtered by category and/or publisher.
 *
 * @param db - Injectable Drizzle database used by pages and tests.
 * @param filters - Optional category and publisher ids from the URL query.
 * @returns Games matching the selected filters, ordered by title.
 */
export async function getFilteredGames(
    db: Database,
    filters: { categoryId?: number; publisherId?: number },
): Promise<Game[]> {
    const conditions: Array<ReturnType<typeof eq>> = [];

    if (filters.categoryId !== undefined) {
        conditions.push(eq(games.categoryId, filters.categoryId));
    }

    if (filters.publisherId !== undefined) {
        conditions.push(eq(games.publisherId, filters.publisherId));
    }

    const query = baseGamesQuery(db);
    const rows = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(asc(games.title))
        : await query.orderBy(asc(games.title));

    return rows.map(mapGame);
}

/**
 * Get all game ids ordered by title.
 *
 * @param db - Injectable Drizzle database used by pages and tests.
 * @returns Game ids sorted for deterministic static builds.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Get a single game by id.
 *
 * @param db - Injectable Drizzle database used by pages and tests.
 * @param id - Game id to look up.
 * @returns The matching game, or `null` when no row exists.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
