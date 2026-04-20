/**
 * Unit tests for routeParser.js
 */

import { parseMovementPath } from '../routeParser';

describe('parseMovementPath', () => {
    it('splits numbered lines', () => {
        const result = parseMovementPath('1) 지하2층 엘리베이터 탑승\n2) 대합실 이동');
        expect(result.length).toBe(2);
        expect(result[0].floor).toBe('B2F');
        expect(result[0].originalText).toBe('지하2층 엘리베이터 탑승');
    });

    it('extracts 지하 floor', () => {
        const result = parseMovementPath('지하1층 개찰구 통과');
        expect(result[0].floor).toBe('B1F');
    });

    it('extracts 지상 floor', () => {
        const result = parseMovementPath('지상1층 엘리베이터 탑승');
        expect(result[0].floor).toBe('1F');
    });

    it('returns empty for empty input', () => {
        expect(parseMovementPath('')).toEqual([]);
        expect(parseMovementPath(null)).toEqual([]);
    });
});
