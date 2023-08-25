using System;
using System.Collections;
using System.Collections.Generic;

using Rhino;
using Rhino.Geometry;

using Grasshopper;
using Grasshopper.Kernel;
using Grasshopper.Kernel.Data;
using Grasshopper.Kernel.Types;

using System.Security.Cryptography;
using System.Linq;
using System.Text;


/// <summary>
/// This class will be instantiated on demand by the Script component.
/// </summary>
public abstract class Script_Instance_c7115 : GH_ScriptInstance
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
  private void RunScript(List<double> Identifiers, ref object Keys)
  {
    string message = "";
    for (int i=0;i<Identifiers.Count;i++) {
      message += GetInt(Identifiers[i]).ToString();
    }
    Keys = ComputeSha256Hash(message);
  }
  #endregion
  #region Additional

  private int GetInt(double x) {
    return (int) Math.Round(x * 100000);
  }
  
  private string ComputeSha256Hash(string rawData)
  {
    // Create a SHA256
    using (SHA256 sha256Hash = SHA256.Create())
    {
      // ComputeHash - returns byte array
      byte[] bytes = sha256Hash.ComputeHash(Encoding.UTF8.GetBytes(rawData));

      // Convert byte array to a string
      StringBuilder builder = new StringBuilder();
      for (int i = 0; i < bytes.Length; i++)
      {
        builder.Append(bytes[i].ToString("x2"));
      }
      return builder.ToString();
    }
  }
  #endregion
}