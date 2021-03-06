package com.cloudpos.apidemo.jniinterface;

public class SerialPortInterface 
{
	static
	{
		System.loadLibrary("jni_cloudpos_serial");
	}
	/*native interface */
	public native static int open();
	public native static int close();
	public native static int read(byte pDataBuffer[], int offset, int nExpectedDataLength, int nTimeout_MS);
	public native static int write(byte pDataBuffer[], int nDataLength);
	public native static int set_baudrate(int nBaudrate);
	public native static int flush_io();

}
