using System;
using System.Collections;
using System.Collections.Generic;

using Rhino;
using Rhino.Geometry;

using Grasshopper;
using Grasshopper.Kernel;
using Grasshopper.Kernel.Data;
using Grasshopper.Kernel.Types;

using System.Linq;


/// <summary>
/// This class will be instantiated on demand by the Script component.
/// </summary>
public abstract class Script_Instance_cd857 : GH_ScriptInstance
{
  #region Utility functions
  /// <summary>Print a String to the [Out] Parameter of the Script component.</summary>
  /// <param name="text">String to print.</param>
  private void Print(string text) { /* Implementation hidden. */ }
  /// <summary>Print a formatted String to the [Out] Parameter of the Script component.</summary>
  /// <param name="format">String format.</param>
  /// <param name="args">Formatting parameters.</param>
  private void Print(string format, params object[] args) { /* Implementation hidden. */ }
  /// <summary>Print useful information about an object instance to the [Out] Parameter of the Script component. </summary>
  /// <param name="obj">Object instance to parse.</param>
  private void Reflect(object obj) { /* Implementation hidden. */ }
  /// <summary>Print the signatures of all the overloads of a specific method to the [Out] Parameter of the Script component. </summary>
  /// <param name="obj">Object instance to parse.</param>
  private void Reflect(object obj, string method_name) { /* Implementation hidden. */ }
  #endregion

  #region Members
  /// <summary>Gets the current Rhino document.</summary>
  private readonly RhinoDoc RhinoDocument;
  /// <summary>Gets the Grasshopper document that owns this script.</summary>
  private readonly GH_Document GrasshopperDocument;
  /// <summary>Gets the Grasshopper script component that owns this script.</summary>
  private readonly IGH_Component Component;
  /// <summary>
  /// Gets the current iteration count. The first call to RunScript() is associated with Iteration==0.
  /// Any subsequent call within the same solution will increment the Iteration count.
  /// </summary>
  private readonly int Iteration;
  #endregion
  /// <summary>
  /// This procedure contains the user code. Input parameters are provided as regular arguments,
  /// Output parameters as ref arguments. You don't have to assign output parameters,
  /// they will have a default value.
  /// </summary>
  #region Runscript
  private void RunScript(List<string> HashValues, List<string> OriginalTileHashValues, int QueryOriginalType, int QueryExtraType, ref object Count, ref object AllOriginalTiles, ref object AllExtraTiles, ref object QueryOriginalResults, ref object QueryExtraResults)
  {
    int total = HashValues.Count;
    HashSet<string> set = new HashSet<string>();
    for (int i = 0;i < total;i++) {
      set.Add(HashValues[i]);
    }
    Count = set.Count;


    List<string> setList = set.ToList();
    List<string> extraTileHashValues = new List<string>();
    DataTree<object> allOriginalTiles = new DataTree<object>();
    DataTree<object> allExtraTiles = new DataTree<object>();


    if (OriginalTileHashValues != null && OriginalTileHashValues.Count > 0) {
      foreach (string key in setList) {
        if (!OriginalTileHashValues.Contains(key)) {
          extraTileHashValues.Add(key);
        }
      }

      QueryOriginalType %= OriginalTileHashValues.Count;
      List<int> queryOriginalResults = new List<int>();
      for (int i = 0;i < total;i++) {
        if (OriginalTileHashValues.Contains(HashValues[i])) {
          allOriginalTiles.Add(i, new GH_Path(OriginalTileHashValues.IndexOf(HashValues[i])));
        }
        if (HashValues[i] == OriginalTileHashValues[QueryOriginalType]) {
          queryOriginalResults.Add(i);
        }
      }
      QueryOriginalResults = queryOriginalResults;
    }
    else {
      extraTileHashValues = setList;
    }

    QueryExtraType %= set.Count;
    List<int> queryExtraResults = new List<int>();
    for (int i = 0;i < total;i++) {
      if (extraTileHashValues.Contains(HashValues[i])) {
        allExtraTiles.Add(i, new GH_Path(extraTileHashValues.IndexOf(HashValues[i])));
      }
      if (HashValues[i] == extraTileHashValues[QueryExtraType]) {
        queryExtraResults.Add(i);
      }
    }
    QueryExtraResults = queryExtraResults;

    AllOriginalTiles = allOriginalTiles;
    AllExtraTiles = allExtraTiles;
  }
  #endregion
  #region Additional

  #endregion
}