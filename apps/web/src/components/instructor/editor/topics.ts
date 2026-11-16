'use client';

import { QuestionTopicSchema, type QuestionTopic } from '@obgyn/types';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { api } from '@/lib/instructor-api';

const parseTopics = (data: unknown) => z.array(QuestionTopicSchema).parse(data);

/** The course's question topics, in course order. */
export function useTopics(courseId: string) {
  const [topics, setTopicsState] = useState<QuestionTopic[] | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(
    () =>
      api('GET', `instructor/courses/${courseId}/topics`)
        .then((data) => setTopicsState(parseTopics(data)))
        .catch(() => setError(true)),
    [courseId],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  return { topics, setTopics: (data: unknown) => setTopicsState(parseTopics(data)), error, reload };
}
