import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Mike VanVickle'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const counties = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/counties' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    county: z.string(),
    cadName: z.string().optional(),
    cadWebsite: z.string().optional(),
    filingDeadline: z.string().optional(),
    avgSavings: z.string().optional(),
  }),
});

export const collections = { blog, counties };
