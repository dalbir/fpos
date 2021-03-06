package at.oerp.demo.poshw;

import java.io.IOException;
import java.util.Random;

import android.app.Activity;
import android.content.Intent;
import android.os.AsyncTask;
import android.os.Build;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.View.OnClickListener;
import android.widget.Button;
import android.widget.TabHost;
import android.widget.TextView;
import at.oerp.pos.PosHwDisplay;
import at.oerp.pos.PosHwScan;
import at.oerp.pos.PosHwService;
import at.oerp.pos.R;
import at.oerp.pos.WeightResult;
import at.oerp.pos.hw.android.BTPrinter;



public class MainActivity extends Activity {

	private TextView infoTextView;
	private PosHwService posHw;
	private ScaleTask scaleTask;
	private Random random;
	private BTPrinter btPrinter;
	
	private final static int REQUEST_SCAN = 1;
	
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.activity_main);
		
		infoTextView = (TextView) findViewById(R.id.infoView);
		show(Build.MODEL + "\n" + Build.MANUFACTURER);
		random = new Random();
		
		TabHost host = (TabHost) findViewById(R.id.tabHost);
		host.setup();
		
		// Tab 1
		TabHost.TabSpec spec = host.newTabSpec("Print");
		spec.setContent(R.id.tabPrint);
		spec.setIndicator(spec.getTag());
		host.addTab(spec);
		
		// Tab 2
		spec = host.newTabSpec("Other");
		spec.setContent(R.id.tabOther);
		spec.setIndicator(spec.getTag());
		host.addTab(spec);
		
		
		posHw = PosHwService.create(getApplication());
		if ( posHw != null ) {
			posHw.open();
		} else {
			show(infoTextView.getText()+"\nNo Hardware Service");
		}
		
		Button printButton = (Button) findViewById(R.id.printButton);
		printButton.setOnClickListener(new OnClickListener() {
			@Override
			public void onClick(View v) {
				try {
					String test =
							   "<br>Zeile1" +
							   "<br>Zeile2" +
							   "<br>Zeile3" +
							   "<br>xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" +
							   "<br>----------------------------------------------------" +
							   "<br>xyz12345abcdefghijklmnopxyz12345abcdefghijklmnopxyz1" +
							   "<br>Wielange darf eine Zeile sein damit sie sich ausgeht" +
			                   "<br>um zu testen ob der Druck" +
			                   "<br>funktioniert"+
			                   "<br><br><br><br><br><br>";
					posHw.getPrinter().printHtml(test);
					//posHw.getPrinter().printTest();
				} catch (IOException e) {
					handleError(e);
				};				
			}
		});
		
		Button weighButton = (Button) findViewById(R.id.weightButton);
		weighButton.setOnClickListener(new OnClickListener() {
			
			@Override
			public void onClick(View v) {
				try {
					float price = (float) (Math.random()*20.0);
					if ( scaleTask == null ) {
						scaleTask = new ScaleTask(price, 0.0f);						
						scaleTask.execute();
					} else {
						scaleTask.price = price;
						scaleTask.init = true;
					}
				} catch (Exception e) {
					handleError(e);
				} 
				
			}
		});
		
		Button displayButton = (Button) findViewById(R.id.displayButton);
		displayButton.setOnClickListener(new OnClickListener() {
			
			@Override
			public void onClick(View v) {
				PosHwDisplay disp = posHw.getCustomerDisplay();
				if ( disp != null ) {
					double displayVal = Math.round((random.nextDouble()*1000)*100)/100.0;
					try {
						if ( disp.fullCharset() ) {
							disp.setDisplay(String.format("%1$,.2f €", displayVal));
						} else {
							disp.setDisplay(Double.toString(displayVal));
						}
					}  catch (IOException e) {
						handleError(e);
					}
				}
			}
		});
		
		Button openButton = (Button) findViewById(R.id.openButton);
		openButton.setOnClickListener(new OnClickListener() {
			@Override
			public void onClick(View v) {
				try {
					posHw.openCashDrawer();
				} catch (IOException e) {
					handleError(e);
				}				
			}
		});
		
		
		Button provisionButton = (Button) findViewById(R.id.provisioningButton);
		provisionButton.setOnClickListener(new OnClickListener() {
			@Override
			public void onClick(View v) {
				try {
					posHw.provisioning();
				} catch (IOException e) {
					handleError(e);
				}				
			}
		});
		
		Button btOpenButton = (Button) findViewById(R.id.openBTButton);
		btOpenButton.setOnClickListener(new OnClickListener() {
			@Override
			public void onClick(View v) {
				if ( btPrinter == null ) {
					btPrinter = BTPrinter.create(posHw);
					if ( btPrinter != null ) {
						log("Bluetooth printer opened");
					} else {
						log("No printer found!");
					}
				}
			}
		});
		
		Button btPrintButton = (Button) findViewById(R.id.printBTButton);
		btPrintButton.setOnClickListener(new OnClickListener() {
			@Override
			public void onClick(View v) {
				if ( btPrinter != null ) {
					String test =
							   "<br>Zeile1" +
							   "<br>Zeile2" +
							   "<br>Zeile3" +
							   "<br>xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" +
							   "<br>----------------------------------------------------" +
							   "<br>xyz12345abcdefghijklmnopxyz12345abcdefghijklmnopxyz1" +
							   "<br>Wielange darf eine Zeile sein damit sie sich ausgeht" +
			                   "<br>um zu testen ob der Druck" +
			                   "<br>funktioniert"+
			                   "<br><br><br><br><br><br>";
					try {
						btPrinter.printHtml(test);
						log("Bluetooth printed");
					} catch (IOException e) {
						handleError(e);
					}
				}
			}
		});
		
		
		Button btCloseButton = (Button) findViewById(R.id.closeBTButton);
		btCloseButton.setOnClickListener(new OnClickListener() {
			@Override
			public void onClick(View v) {
				if ( btPrinter != null ) {
					btPrinter.close();
					btPrinter = null;
					log("Bluetooth printer closed");
				}
			}
		});
		
		Button btScanButton = (Button) findViewById(R.id.scanButton);
		btScanButton.setOnClickListener(new OnClickListener() {
			
			@Override
			public void onClick(View v) {
				Class<? extends Activity> activityClass = posHw.getScanActivity();				
				Intent intent = new Intent(MainActivity.this.getApplicationContext(), activityClass);				
				startActivityForResult(intent, REQUEST_SCAN);
				
			}
		});
		
	}
	
	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		if ( requestCode == REQUEST_SCAN ) {
			if ( resultCode == RESULT_OK ) {
				show(data.getStringExtra(PosHwScan.RESULT_TEXT) + "\n" + data.getStringExtra(PosHwScan.RESULT_TEXT));
			}
		}		
	}
	
	protected void handleError(Throwable e) {
		e.printStackTrace();
	}
	
	protected void show(String inText) {
		infoTextView.setText(inText);
	}
	
	protected void log(String inText) {
		if ( inText != null ) {
			CharSequence curText = infoTextView.getText();			
			if ( curText == null ) {
				infoTextView.setText(inText);
			} else {
				StringBuilder b = new StringBuilder(curText);
				b.append("\n");
				b.append(inText);
				infoTextView.setText(b.toString());
			}
		}
	}
	
	protected void showWeighResult(WeightResult inResult) throws IOException {
		if ( inResult != null ) {
			show("Gewicht: " + Float.toString(inResult.weight) + "\n" 
			    + "Preis: " + Float.toString(inResult.price) + "\n"
			    + "Total: " + Float.toString(inResult.total));
		} else {
			show("Weighing...");
		}
	}
	
	
	
	private class ScaleTask extends AsyncTask<Void, WeightResult, Void> {

		float price;
		float tara;
		boolean init;
		
		public ScaleTask(float inPrice, float inTara) {
			super();
			price = inPrice;
			tara = inTara;
			init = true;
		}
		
		@Override
		protected void onProgressUpdate(WeightResult... values) {
			super.onProgressUpdate(values);
			try {
				if ( values != null) {
					for ( WeightResult value : values) {
						showWeighResult(value);
					}
				}
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
		
		@Override
		protected Void doInBackground(Void... params) {
			WeightResult result = new WeightResult();
			try {				
				while ( !isCancelled() ) {
					if ( init ) {
						if ( posHw.getScale().init(price, tara) ) {
							init = false;
						}
					} else {
						boolean successful =  posHw.getScale().readResult(result);
						if ( successful) {
							if ( result.price != price) {
								init = true;
							} 
							publishProgress(result);
						}
						Thread.sleep(250);
					}
				}
			} catch (Exception e) {
				e.printStackTrace();
			}
			return null;
		}
		
	}

	@Override
	public boolean onCreateOptionsMenu(Menu menu) {
		// Inflate the menu; this adds items to the action bar if it is present.
		getMenuInflater().inflate(R.menu.main, menu);
		return true;
	}

	@Override
	public boolean onOptionsItemSelected(MenuItem item) {
		// Handle action bar item clicks here. The action bar will
		// automatically handle clicks on the Home/Up button, so long
		// as you specify a parent activity in AndroidManifest.xml.
		int id = item.getItemId();
		if (id == R.id.action_settings) {
			return true;
		}
		return super.onOptionsItemSelected(item);
	}
}
