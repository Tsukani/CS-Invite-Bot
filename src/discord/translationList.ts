export const timeTranslations: Record<string, string> = {
    5: '5 seconds',
    30: '30 seconds',
    60: '1 minute',
    300: '5 minutes',
    600: '10 minutes'
};

export const rankTranslations: Record<string, string> = {
    1: 'Silver I',
    2: 'Silver II',
    3: 'Silver III',
    4: 'Silver IV',
    5: 'Silver Elite',
    6: 'Silver Elite Master',
    7: 'Gold Nova I',
    8: 'Gold Nova II',
    9: 'Gold Nova III',
    10: 'Gold Nova Master',
    11: 'Master Guardian I',
    12: 'Master Guardian II',
    13: 'Master Guardian Elite',
    14: 'Distinguished Master Guardian',
    15: 'Legendary Eagle',
    16: 'Legendary Eagle Master',
    17: 'Supreme Master First Class',
    18: 'The Global Elite'
};

export const gamemodeTranslations: Record<string, string> = {
    competitive: 'Premiere',
    scrimcomp2v2: 'Wingman'
};

export const getCSRatingIcon = (rating: number) => {
    // Premiere CS Rating Discord emojis
    const ratings: Record<string, { min: number; max: number }> = {
        '<:csratingcommon:1161020611720663211>': { min: 0, max: 4999 },
        '<:csratinguncommon:1161020634739003513>': { min: 5000, max: 9999 },
        '<:csratingrare:1161020653688848454>': { min: 10000, max: 14999 },
        '<:csratingmythical:1161020677512495237>': { min: 15000, max: 19999 },
        '<:csratinglegendary:1161020687436230748>': { min: 20000, max: 24999 },
        '<:csratingancient:1161020699863961621>': { min: 25000, max: 29999 },
        '<:csratingunusual:1161020710181945435>': { min: 30000, max: Infinity }
    };

    return Object.keys(ratings).find((key) => {
        const { min, max } = ratings[key];
        return rating >= min && rating <= max;
    });
};
