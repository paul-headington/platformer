/**
 * Level 1, drawn as text. Each character is one 16x16 tile.
 *
 *   #  brick (solid)          =  stone ledge (jump up through it)
 *   H  ladder (Up/Down)       /  \  stairs (walk up them)
 *   ^  spikes                 *  gem
 *   G  gun pickup             K  key (opens the exit door)
 *   D  exit door              P  player start
 *   z  zombie (walks)         g  ghost (floats)
 *
 * Every row must be the same length. Leave two empty tiles above any floor,
 * stair or ladder top so the player (24px tall) fits.
 *
 * Stairs: a run of / climbs up to the right, a run of \ climbs up to the left,
 * one tile up per tile across. The floor at the top of a run is level with the
 * last stair, and the floor at the bottom is one row below the first.
 *
 * Ladders: the top H of a ladder can be stood on, so a ladder can poke up
 * through a hole in a floor. Press Down on it to climb back down.
 *
 * The map is a raw string (so \ needs no escaping), split into rows below.
 */
const MAP = String.raw`
####################################################################################################
#                                                                                                  #
#                                                                                                  #
#                                     **                                                           #
#                                    ====                                                          #
#            K                                    g               g                                #
#         #######\           * *                                                                   #
#         ########\         =====                           =====                                  #
#         #########\                                *                           * *                #
#         ##########\   *           ^^                                ^^^                          #
########H#################################################################################H#########
#       H                                                                                 H        #
#       H                                                                                 H        #
#       H                                                                                 H        #
#       H                                                           g                     H        #
#       H    * *                                           * *                            H        #
#       H   =====                                         =====                 ===       H        #
#       H                                                                                 H        #
#       H         z           D                                                     z     H        #
########################################         /#########################H########################
#                                               /#                         H                       #
#                                              /##                         H                       #
#                     * * *                   /###                         H                       #
#                    =====                   /####                         H                       #
#                                           /#####                         H                       #
#             G                            /######      **                 H         * *           #
#           =====                         /#######     ====                H        ====           #
#                                        /########                         H                       #
#  P                       z   ^^^      /#########            z     ^^     H                z      #
###################   ##############################################################################
`;

export const LEVEL_1: string[] = MAP.split('\n').filter((row) => row.length > 0);
