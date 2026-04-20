import { supabase } from '../../lib/supabase';

/**
 * FeedbackService: Manages user feedback (Likes/Dislikes) for route segments.
 */
export class FeedbackService {
    /**
     * Submits feedback for a specific route segment.
     * @param {string} routeKey - Unique key for the route (e.g., originId_destId_originExit_destExit)
     * @param {number} segmentIndex - Index of the segment in the route
     * @param {string} feedbackType - Type of feedback ('like' | 'dislike')
     * @param {string} hashKey - Optional: hash_key for movement_translations
     */
    static async submitFeedback(routeKey, segmentIndex, feedbackType, hashKey = null) {
        if (!routeKey) {
            console.error('[FeedbackService] Missing routeKey for feedback submission.');
            return { error: 'Missing routeKey' };
        }

        try {
            const { data, error } = await supabase
                .from('route_feedback')
                .insert([
                    {
                        route_key: routeKey,
                        segment_index: segmentIndex,
                        feedback_type: feedbackType,
                    }
                ]);

            if (error) {
                if (error.code === '42P01') {
                    console.error('[FeedbackService] ⚠️ Table "route_feedback" not found in Supabase. Please run the SQL migration script.');
                }
                throw error;
            }

            console.log(`[FeedbackService] ✅ Feedback submitted: ${feedbackType} for ${routeKey} segment ${segmentIndex}`);

            // Optional: Granular feedback for movement_translations
            if (hashKey) {
                const { error: rpcError } = await supabase.rpc('increment_translation_count', {
                    target_hash_key: hashKey,
                    is_like: feedbackType === 'like'
                });
                if (rpcError) {
                    console.warn('[FeedbackService] Failed to update movement_translations counts:', rpcError.message);
                } else {
                    console.log(`[FeedbackService] ✅ Granular feedback updated for hash: ${hashKey}`);
                }
            }

            return { data };
        } catch (err) {
            console.error('[FeedbackService] Feedback submission failed:', err);
            return { error: err.message };
        }
    }

    /**
     * Optional: Get feedback counts for a route key (to show to other users)
     */
    static async getFeedbackCounts(routeKey) {
        try {
            const { data, error } = await supabase
                .from('route_feedback')
                .select('feedback_type')
                .eq('route_key', routeKey);

            if (error) throw error;

            const counts = { like: 0, dislike: 0 };
            data.forEach(item => {
                if (item.feedback_type === 'like') counts.like++;
                if (item.feedback_type === 'dislike') counts.dislike++;
            });

            return counts;
        } catch (err) {
            console.error('[FeedbackService] Failed to fetch feedback counts:', err);
            return { like: 0, dislike: 0 };
        }
    }
}
