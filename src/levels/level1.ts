/**
 * Level 1, drawn as text. Each character is one 16x16 tile.
 *
 *   #  brick (solid)          =  stone ledge (jump up through it)
 *   ^  spikes                 *  gem
 *   G  gun pickup             K  key (opens the exit door)
 *   D  exit door              P  player start
 *   z  zombie (walks)         g  ghost (floats)
 *
 * Every row must be the same length.
 */
export const LEVEL_1: string[] = [
  '####################################################################################################',
  '#                                                                                                  #',
  '#                                                                                         K        #',
  '#                                                                                       ====       #',
  '#                                                         g                                        #',
  '#                                                * * *                                             #',
  '#                                                =====                             ====            #',
  '#                                                                               g                  #',
  '#       * * *                G                                       **                            #',
  '#       =====              =====           =====                    ====      ====                 #',
  '#                                                           ##                                     #',
  '#  P            z    ^^^                                 z  ##  ^^^     z                       D  #',
  '#####################################   ############################################################',
];
